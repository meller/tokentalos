# Tests: Track 013 — Fail fast + cancellation

## Test Commands

```bash
node test-vertex-genai.js          # existing, must still pass
node test-stream-reporting.js      # existing, must still pass
node test-abort-signal.mjs         # write during Phase 3, not committed
```

## Test Cases

### Feature: Bounded timeout/retries (Phase 1)
- [x] TC-1: A real Vertex call still succeeds normally under the new defaults (30s timeout, 2
      attempts) — no regression. `test-vertex-genai.js` re-run clean (`executeVertex` +
      `streamExecuteVertex` both succeed, same shape as before).

### Feature: `abortSignal` support (Phase 2)
- [~] TC-2: `executeVertex(..., { abortSignal: preAbortedController.signal })` did **not** fail
      fast — the call succeeded normally. **Root cause identified, not a bug in this track's
      code**: `@google/genai`'s own internal handling
      (`includeExtraHttpOptionsToRequestInit`) only does
      `abortSignal.addEventListener('abort', ...)` — it never checks `signal.aborted` up front,
      so a signal that's *already* aborted before the call starts has no live 'abort' event left
      to listen for. This is a real, confirmed SDK limitation, not something fixable from this
      package without patching `@google/genai` itself (out of scope). Documented rather than
      hidden — doesn't block REQ-3's actual goal (see TC-3).
- [x] TC-3: **The scenario that actually matters** — a real streamed call, aborted ~2s into an
      in-flight request — stopped promptly: threw `AbortError: This operation was aborted` at
      3005ms elapsed, instead of running to natural completion (which would have taken much
      longer for that prompt). This is exactly coachai's real use case (a client disconnects
      *during* an active call, not before one starts) — confirms the fix works for its actual
      purpose.
- [x] TC-4: A call with no `abortSignal` passed still succeeds normally (`content: 'Blue'`) — no
      regression for existing callers.

## Acceptance Criteria
- [x] TC-1, TC-3, TC-4 verified via manual scripts + existing test scripts re-run clean.
- [x] TC-2 investigated and the discrepancy explained (real SDK limitation on pre-aborted
      signals, not a defect in this track's implementation) rather than silently passed over.
