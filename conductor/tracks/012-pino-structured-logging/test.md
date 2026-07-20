# Tests: Track 012 — Structured (pino) logging

## Test Commands

```bash
node test-vertex-genai.js          # existing, must still pass
node test-stream-reporting.js      # existing, must still pass
node test-logger-injection.mjs     # write during Phase 5, not committed
```

## Test Cases

### Feature: Shared default logger (Phase 1)
- [x] TC-1: `getLogger()` called twice returns the SAME instance. PASS.
- [x] TC-2: The default logger's output is valid JSON per line — confirmed via
      `test-vertex-genai.js`/`test-stream-reporting.js` real output (e.g.
      `{"level":30,"time":...,"name":"tokentalos","msg":"..."}`).

### Feature: `config.logger` injection (Phase 2, REQ-3/4/5)
- [x] TC-3: `new TokenTalosEngine({ logger: fakeLogger })` uses the injected instance (verified
      with a spy object — `engine.logger === fakeLogger`). PASS.
- [x] TC-4: `new TokenTalosEngine({})` (no `config.logger`) falls back to `getLogger()`'s shared
      default — `engine.logger === getLogger()`. PASS.

### Feature: Call-site conversion (Phase 3)
- [x] TC-5: `grep -rn "console\.\(log\|warn\|error\)" lib/engine/ index.js` returns zero matches
      (one remaining hit is a comment mentioning "console.warn" in prose, not a call).
- [x] TC-6: `test-vertex-genai.js` re-run post-conversion — identical behavior, real Vertex call
      still succeeds, now logs via pino instead of plain console.

### Feature: Track 011 persist-failure logging (Phase 4, REQ-8)
- [x] TC-7: Not re-run as a separate forced-failure test this pass (Track 011 already verified
      the fallback-file half of this catch block with a forced-error test); the new
      `this.logger.error(...)` call was added alongside it using the same structured fields —
      verified by code inspection and the fact `test-stream-reporting.js`'s successful path
      exercises the same logger instance correctly.

### Feature: End-to-end via coachai's `npm link` (Phase 5, REQ-spec's real acceptance test)
- [x] TC-8: From coachai's linked dev environment, called `getTokenTalos()` directly — its
      `engine.logger` is set, and the resulting stdout during initialization was valid pino JSON
      (`{"level":30,...,"name":"tokentalos","msg":"[TokenTalos] PostgreSQL initialized"}`) —
      exactly what `node server/index.mjs | npx pinorama --open` needs to actually parse and
      surface, closing the original observability gap. PASS.

## Acceptance Criteria
- [x] TC-1 through TC-6 verified via manual scripts.
- [x] TC-7 verified by inspection (structural parity with the already-tested fallback file path).
- [x] TC-8 verified from coachai's linked environment — the real acceptance signal.
- [x] `test-vertex-genai.js` and `test-stream-reporting.js` both re-run and still pass.
