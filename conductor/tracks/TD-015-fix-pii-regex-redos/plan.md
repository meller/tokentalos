# Track TD-015: Fix catastrophic-backtracking DoS in prompt construction

## Phase 1: Fix the PII email regex ReDoS

- [x] Task 1: In `lib/engine/pii_detector.js`, bound the `email` pattern's
      local-part quantifier (`[a-zA-Z0-9._%+-]+` → `[a-zA-Z0-9._%+-]{1,64}`)
      and the domain-part quantifier (`[a-zA-Z0-9.-]+` → `[a-zA-Z0-9.-]{1,253}`)
      so a long run with an `@` but no valid TLD can't reproduce the same
      failure mode on the second half of the pattern.
- [x] Task 2: Re-ran the isolated benchmark (100K-char run, no `@`) and
      confirmed `detectPII()` dropped from ~18s to sub-ms.
- [x] Task 3: Audited `api_key`, `ssn`, `phone` in `pii_detector.js` and
      `INJECTION_PATTERNS`/`SECRET_PATTERNS` in `security.js` — none share
      the vulnerable shape (unbounded quantifier *before* a possibly-absent
      literal); all others have their unbounded quantifier trailing with
      nothing after to backtrack against, or are already length-bounded.
      Confirmed fast (0-14ms) on the same adversarial input. No changes
      needed there.
- [x] Task 4: Added a regression test (`tests/pii.test.js`) asserting
      `detectPII()` completes within 200ms on a 100K-char non-matching
      input, and that an email embedded in a long run is still detected
      correctly.

## Phase 2: Fix the BPE tokenizer ReDoS (found after Phase 1 alone didn't fix the live hang)

- [x] Task 1: Benchmarked `TokenCounter.countTokens()` in isolation against
      a repeated-character run — confirmed O(n²)-ish blowup independent of
      any PII config (1K chars: 296ms: 20K chars: 25,927ms).
- [x] Task 2: Added a cheap O(n) `hasLongRepeatedRun()` guard in
      `lib/engine/tokenizers.js` (bails out at a 300-char run) that routes
      pathological input to the existing length-based estimate instead of
      the real BPE encode, leaving normal prompts on the exact-count path
      unaffected.
- [x] Task 3: Re-benchmarked: repeated-character runs up to 100K chars now
      resolve in 0-1ms; normal prose (9K chars) still takes the real BPE
      path (189ms) and returns an accurate count.

## Phase 3: Fix the body size limit (secondary, found in the same pass)

- [x] Task 1: Added an explicit `limit: '10mb'` to `api/index.js`'s
      `express.json()` call.
- [x] Task 2: Confirmed `dashboard/` doesn't run a second, separate Express
      app that also needs the same fix (grepped for `express.json`/`express()`
      under `dashboard/` — no matches; it's served by the same `api/index.js`).
- [x] Task 3: Manual smoke test folded into Phase 4's live reproduction.

## Phase 4: Verify

- [x] Task 1: Ran `npm test` (full suite, `api/` package) — 9 suites, 28
      tests, all passing, including the new regression tests in
      `tests/pii.test.js`.
- [x] Task 2: Re-ran the original live reproduction (6 sequential
      ~90-150KB single-run-character POSTs) against a freshly started
      local collector with all three fixes applied:
      - Before any fix: process pegged at ~46% CPU, fully unresponsive
        (accept queue backed up) for minutes.
      - After Phase 1 (regex) alone: **still hung** — proved the
        tokenizer was an independent second cause, not covered by the
        regex fix.
      - After Phase 1 + 2 + 3 together: all 6 requests completed in
        0.37-1.11s each (fast 500s from an unrelated fake-credentials
        Vertex/Gemini auth error, not a hang), `/api/v1/health` answered
        in 2ms immediately after, and process CPU returned to 1.8%
        (idle).

## Root Cause

Two independent, unrelated bugs on the same request path, both
demonstrated with isolated benchmarks (not guesswork) and both confirmed
via a live before/after reproduction:

1. `lib/engine/pii_detector.js`'s `email` regex has an unbounded greedy
   quantifier before a possibly-absent `@`, causing O(n²) backtracking.
   `detectPII()` took 18.2s on a 100K-char non-matching input while every
   other pattern in the same call stack resolved in single-digit ms on
   the same input. Gated behind `formattingFeatures.includes('pii')`,
   which is `TokenTalosEngine`'s **default**.
2. `lib/engine/tokenizers.js`'s `countTokens()` calls `js-tiktoken`'s pure-JS
   BPE `encode()` unconditionally on every prompt part for every
   `/execute` call (no feature flag gates this one). Its merge loop
   degrades similarly badly on long runs of a single repeated character
   (20K chars: 25.9s).

A downstream project's (MakroDash) own usage history — large
natural-language prompts (79-145K chars) succeeding historically, a
smaller (32K char) but differently-shaped prompt failing today — is what
surfaced this, but neither bug is about payload *size*; both are about
input *shape* (a long unbroken run of matching/repeated characters, which
natural language rarely produces but structured/padded data can). A
separate, lower-severity `express.json()` body-limit issue (Phase 3) was
found in the same pass and is real, but is not what caused the hang — it
produces a fast, clean 413, not an unresponsive process. An earlier
version of this plan wrongly treated the body limit as the sole/primary
cause; it's the least severe of the three.
