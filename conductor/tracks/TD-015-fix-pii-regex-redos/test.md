# Tests: Track TD-015 — Fix PII regex + BPE tokenizer ReDoS, collector body size limit

## Test Commands
```bash
npm test
```

## Test Cases

### Feature: detectPII no longer exhibits catastrophic backtracking
- [x] TC-1: `detectPII('x'.repeat(100000))` (no `@` anywhere) completes in
      under 200ms and returns `[]`. (Was ~18,197ms before the fix.)
- [x] TC-2: A real email embedded in a long string is still correctly
      detected by `detectPII()` and completes in well under 200ms.
      (Automated as `tests/pii.test.js`'s "should still detect an email
      embedded in a long run" case.)
- [x] TC-3: `maskPII()` on the same kind of embedded-email input still
      masks correctly (covered by the existing `tests/pii.test.js`
      email-detection assertions the fix left unmodified).
- [x] TC-4: Existing `tests/pii.test.js` and `tests/pii_middleware.test.js`
      still pass unmodified (no detection-accuracy regression) — full
      suite: 10 suites / 30 tests, all green.

### Feature: collector API accepts large JSON bodies
- [x] TC-5: POSTed a ~545KB JSON body (varied words, not a pathological
      single run) to a running collector's `/api/v1/usage/execute` —
      passed body-parsing (no 413); failed downstream only on an
      unrelated fake-credentials Vertex/Gemini auth error, confirming the
      body-size limit is no longer the blocker.
- [x] TC-6: POSTed a 15MB body (over the new 10mb limit) — got a clean
      413, confirming the limit is raised, not removed.
- [x] TC-7: POSTed a normal small body (<100KB) — got HTTP 200 with a
      real, successful LLM round-trip in 3.17s — unchanged behavior.

### Feature: countTokens no longer exhibits catastrophic backtracking
- [x] TC-8: `countTokens('x'.repeat(100000), 'openai', 'gpt-4')` completes
      in under 200ms. (Was 26s+ at only 20K chars, unbounded beyond that.)
      Automated as `tests/tokenizers.test.js`.
- [x] TC-9: `countTokens()` on normal prose still takes the real BPE path
      and returns an accurate count (asserted within a tight range that
      excludes the length/4 fallback estimate) — confirms the guard
      doesn't misfire on legitimate large prompts. Automated in the same
      file.

### Feature: live reproduction no longer hangs the process
- [x] TC-10: Start a fresh local collector. POST several ~90-150KB bodies,
      each a single long repeated-character run (the original worst-case
      trigger), back to back. Expected: each gets a fast response (either
      processed or a clean error, never a hang), and `/api/v1/health` stays
      responsive throughout — verified via `ss -tln`/process CPU returning
      to idle between requests.
      **Result**: before any fix, hung indefinitely (process pegged at
      ~46% CPU, accept queue backed up, `/api/v1/health` unreachable).
      After the regex fix alone, still hung (proved the tokenizer was an
      independent second cause). After regex + tokenizer + body-limit
      fixes together: all 6 requests completed in 0.37-1.11s each,
      `/api/v1/health` answered in 2ms, CPU back to 1.8%.

## Acceptance Criteria
- [x] All test cases above pass.
- [x] No regression in existing collector/dashboard test suite (10 suites,
      30 tests, all green).
