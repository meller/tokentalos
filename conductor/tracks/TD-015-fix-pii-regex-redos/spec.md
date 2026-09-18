# Spec: Fix catastrophic-backtracking DoS in prompt construction (PII regex + BPE tokenizer)

## Problem Statement

`lib/engine/pii_detector.js`'s `email` pattern —

```js
/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
```

has an unbounded greedy character class (`[a-zA-Z0-9._%+-]+`) immediately
before a required literal (`@`) that may not appear. When `detectPII()`
(called from `processPromptParts()` whenever `formattingFeatures` includes
`'pii'` — which is `TokenTalosEngine`'s **default** config,
`lib/engine/index.js:18`) scans a string containing a long unbroken run of
characters from that class with no `@` in it, the regex engine backtracks
character-by-character at every start position: O(n²) time for a
non-matching run of length n.

Measured directly (`node` benchmark against the real regex, isolated from
HTTP/DB):
- `scanForSecrets()` (injection + secret patterns): 14ms for a 100K-char run.
- `detectPII()` (the vulnerable email pattern included): **18,197ms** for
  the same 100K-char run — with zero matches found.
- Isolated to the email pattern alone: 60K chars → 4.4s; the other three
  PII patterns (`api_key`, `ssn`, `phone`) are ~0ms on the same input.

Reproduced live: sending a handful of ~90-150KB POST bodies (each a single
long run of one repeated character — a worst-case trigger, but far from a
contrived edge case; any sufficiently long unbroken alphanumeric-ish
segment in a real prompt has the same effect) to a local
`tokentalos start collector` instance left the **single Node.js process
pegged at ~46% CPU and fully unresponsive to every route, including
`/api/v1/health`**, for minutes — confirmed via `ss -tln` showing the
listen socket's accept queue backed up (`Recv-Q` > 0, connections queued
but never accepted) while the process stayed in state `R` (running/CPU-bound).
This is a genuine event-loop-blocking DoS, not just a slow response.

### Why this wasn't caught by the original (wrong) theory

An earlier pass at this bug assumed the failure was a plain
`express.json()` body-size limit (Express/body-parser's undeclared
100KB default) — reasoning that a ~30K-char downstream prompt was simply
"too big". That didn't hold up: the project's own historical usage logs
(`tokentalos.usage_data`, Postgres) show **prompts up to 145,635 and
94,160 characters succeeding** with normal latency, while a same-day
**32,334-character** prompt failed. Payload *size* was never the
differentiator.

The real differentiator is *shape*, not size: the historical large
prompts were natural-language text, broken into short tokens by spaces
and punctuation, so no single backtracking attempt ever got expensive.
The failing prompt (and this session's synthetic reproduction) contained
long *unbroken* runs of alphanumeric-ish characters — e.g. a live-data
block, a concatenated JSON fragment, a long symbol/number list — which is
exactly the shape that makes this regex quadratic.

### A second, independent hang: the BPE tokenizer

Fixing the email regex alone did **not** fix the live reproduction — the
same request pattern still pegged the process. `lib/engine/tokenizers.js`'s
`countTokens()` calls `js-tiktoken`'s `encoding.encode(text)` on every
prompt part, on **every** `/execute` call, regardless of any
`formattingFeatures` config (unlike the PII scan, this has no on/off
switch). Benchmarked directly against a run of one repeated character:

| input length | encode() time |
|---|---|
| 1,000 chars | 296ms |
| 5,000 chars | 1,531ms |
| 10,000 chars | 6,678ms |
| 20,000 chars | 25,927ms |

That's the same O(n²)-ish shape as the regex bug, but in `js-tiktoken`'s
pure-JS BPE merge loop, and it is **always** on the request path — no
config gates it. This is the more severe of the two, since it can't be
avoided by disabling a feature flag.

### Both together explain the live symptom

Killing the email-regex bug alone left the process still hanging on the
worst-case reproduction. Only after also guarding the tokenizer did a
fresh collector stay responsive end-to-end: 6 requests of 90-150KB each
that previously hung for 8s+ (client timeout) each completed in
0.37-1.11s, `/api/v1/health` answered instantly afterward, and process
CPU returned to idle (1.8%) — verified live, not just via isolated
benchmark.

### A third, independent finding: the body size limit

`api/index.js`'s `express.json()` call also has no explicit `limit`
(defaults to body-parser's 100kb), which does still produce a clean 413
for any body over 100KB regardless of shape. This is real — it's what
actually appeared in macrodash's own logs for its original 32K+ char
request — but it's a separate, lower-severity issue from the two above:
a 413 fails fast and cleanly; the regex/tokenizer bugs hang the whole
process for every concurrent caller, independent of whether the body is
even over 100KB. All three are fixed by this track since they were found
during the same investigation.

## Requirements

- REQ-1 (primary): Rewrite `pii_detector.js`'s `email` pattern so it
  cannot exhibit backtracking that scales worse than linear in input
  length, regardless of whether the input contains an `@`. Bound the
  local-part quantifier to a sane maximum (RFC 5321: local part ≤ 64
  octets) rather than leaving it unbounded — this eliminates the
  quadratic blowup by capping the backtrack window to a constant instead
  of the whole input.
- REQ-2: Audit the other three PII patterns (`api_key`, `ssn`, `phone`)
  and the security patterns in `security.js` for the same shape
  (unbounded greedy quantifier immediately before a literal that may be
  absent). Bound any found. (Benchmarked as fine today, but bound
  defensively if the shape is present — don't rely solely on "measured
  fast on today's test input".)
- REQ-3: `countTokens()` in `lib/engine/tokenizers.js` must not exhibit
  worse-than-linear latency on any input, including a pathological long
  run of a single repeated character. Guard the real BPE encode with a
  cheap O(n) pre-check and fall back to a length-based estimate (the same
  estimate already used on encode failure) for that specific shape, so
  normal prompts keep exact BPE counts unaffected.
- REQ-4: `express.json()` in `api/index.js` must accept a generous body
  size (e.g. `10mb`) instead of the undeclared 100kb default, applied to
  every route this API serves.
- REQ-5: No behavior change for any currently-matching PII/secret input,
  and no token-count change for any normal (non-pathological) prompt —
  this is a performance/safety fix, not a detection-accuracy or
  cost-accounting change.

## Acceptance Criteria

- [x] A 100K-character string with no `@` is scanned by `detectPII()` in
      well under 100ms (was 18,197ms).
- [x] A real email address embedded anywhere in a long string is still
      correctly detected and masked (no regression in match behavior).
- [x] `countTokens()` on a 100K-character repeated-character string
      completes in well under 100ms (was unbounded / 26s+ at 20K chars).
- [x] `countTokens()` on normal prose still returns the real BPE token
      count (no accuracy regression for legitimate prompts).
- [x] A JSON body between 100KB and 10MB no longer gets a 413 from the
      collector API.
- [x] A JSON body genuinely over the new 10MB limit still gets a clean
      413.
- [x] Live reproduction: a fresh collector, hit with the original
      90-150KB worst-case burst, stays responsive throughout (fast
      per-request response, `/api/v1/health` answers instantly, CPU
      returns to idle) — verified live, not just benchmarked in isolation.
- [x] Existing collector/dashboard test suite passes, including
      `tests/pii.test.js` and `tests/pii_middleware.test.js`.

## API Contracts / Data Models

None — regex and `express.json({ limit })` changes only, no schema
changes, no change to `detectPII`'s/`maskPII`'s return shape.
