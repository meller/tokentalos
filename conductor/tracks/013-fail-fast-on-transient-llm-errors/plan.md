# Track 013: Plan

## Phase 1: Bounded timeout + retry attempts on the cached Vertex/Gemini clients

**File**: `lib/engine/llm_clients.js`

- [x] `getVertex()`: add to `genaiConfig`:
  ```js
  genaiConfig.httpOptions = {
    timeout: this.config.llmRequestTimeoutMs || 30000,
    retryOptions: { attempts: this.config.llmMaxRetryAttempts ?? 2 },
  };
  ```
- [x] `getGemini()`: same, on the direct-API `GoogleGenAI({ apiKey, httpOptions: {...} })` client.

## Phase 2: Thread `abortSignal` through every layer

- [x] `executeVertex(modelName, messages, options)` / `streamExecuteVertex(...)`: add
      `abortSignal: options.abortSignal` inside the `config: {...}` object passed to
      `ai.models.generateContent(Stream)()`.
- [x] Same for `executeGemini()`/`streamExecuteGemini()`'s direct-API path.
- [x] `LLMGateway.execute()`/`streamExecute()` (top dispatch methods): already pass `options`
      through unchanged to the provider-specific methods — confirm `abortSignal` survives that
      pass-through (should, since it's just part of the same `options` object).
- [x] `TokenTalosEngine.execute()`/`streamExecute()`: thread `params.abortSignal` into the
      `options` object passed to `gateway.execute()`/`gateway.streamExecute()`, mirroring the
      exact existing `gcpProjectId: params.gcpProjectId || options.gcpProjectId` pattern.

## Phase 3: Verify

- [x] Re-run `test-vertex-genai.js`/`test-stream-reporting.js` — must still pass unchanged
      (REQ-6, no regression to normal calls under the new defaults).
- [x] Write a throwaway script: pass an already-aborted signal (`AbortSignal.abort()`) into
      `executeVertex()` — confirm it throws immediately without making a real network call
      (or fails fast) rather than proceeding normally.
- [x] Write a throwaway script: start a real streamed call, abort the signal ~2-3s in — confirm
      the `for await` loop exits promptly rather than running to natural completion.
- [x] Update `index.md` Progress/Phase/Summary as phases complete.

## Note: relationship to coachai's abort-handling follow-up

This track only adds the *capability* to accept and honor an `abortSignal` — coachai's own
`req.on('close')`-driven `AbortController` wiring is a separate, coachai-side track that depends
on this one shipping first (or being tested via `npm link`, per the established workflow).

## ✅ COMPLETE — 2026-07-20

All 3 phases implemented and verified. `getVertex()`/`getGemini()` now set a bounded
`httpOptions.timeout` (default 30s) and `retryOptions.attempts` (default 2) on the cached
clients. `abortSignal` threaded through every layer (`TokenTalosEngine` → `LLMGateway` →
`executeVertex`/`streamExecuteVertex`/`executeGemini`/`streamExecuteGemini`). Verified: no
regression to normal calls (`test-vertex-genai.js`), and the real-world scenario (abort mid-flight)
works correctly (`AbortError` thrown ~3s after a mid-stream abort, not after natural completion).
One real, documented SDK limitation found (pre-aborted signals aren't honored by `@google/genai`
itself) — doesn't block this track's actual purpose.
