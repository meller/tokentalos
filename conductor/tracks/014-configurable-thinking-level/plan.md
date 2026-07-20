# Track 014: Plan

## Phase 1: Resolve the effective thinking level (shared helper)

**File**: `lib/engine/llm_clients.js`

- [x] Add a small private helper on `LLMGateway` (or a module-level function):
  ```js
  resolveThinkingLevel(optionsLevel) {
    if (optionsLevel !== undefined) return optionsLevel; // per-call override, including explicit null
    if ('llmThinkingLevel' in this.config) return this.config.llmThinkingLevel; // engine config, including explicit null
    return 'MINIMAL'; // package default
  }
  ```
- [x] Confirm the `'key' in obj` check is necessary — `this.config.llmThinkingLevel ?? 'MINIMAL'`
      would NOT distinguish "explicitly set to null" from "never set," which REQ-1/REQ-2 require.

## Phase 2: Thread into all four call sites

**File**: same

- [x] `executeVertex`/`streamExecuteVertex`/`executeGemini`/`streamExecuteGemini`: compute
      `const thinkingLevel = this.resolveThinkingLevel(options.thinkingLevel);` and add to the
      `config: {...}` object: `...(thinkingLevel != null ? { thinkingConfig: { thinkingLevel } } : {})`.

## Phase 3: Verify

- [x] Re-run `test-vertex-genai.js`/`test-stream-reporting.js` — confirm they still pass
      functionally (content, token counts, marker behavior), and note their timing is now faster
      by default (not a regression — expected, per REQ-1's new default).
- [x] Write a throwaway script: confirm `config.llmThinkingLevel: null` produces no
      `thinkingConfig` field (verify via a spy/mock on the `generateContent(Stream)` call, or by
      confirming `usageMetadata.thoughtsTokenCount` is present again, matching pre-Track-014
      default behavior).
- [x] Write a throwaway script: confirm a per-call `options.thinkingLevel` override takes
      precedence over an engine-level `config.llmThinkingLevel`.
- [x] Reproduce the real speedup finding once more through the full engine (not just raw
      `@google/genai`) to confirm the plumbing itself doesn't add overhead that erodes the win.
- [x] Update `index.md` Progress/Phase/Summary as phases complete.

## Note: relationship to Track 013

Mirrors Track 013's config-threading pattern (`llmRequestTimeoutMs`, `abortSignal`) but with one
difference: `thinkingConfig` is per-call, not settable at client-construction time the way
`httpOptions` was — so the "engine-level default" here is implemented as a per-call resolution
step, not a one-time client constructor setting.

## ✅ COMPLETE — 2026-07-20

All 3 phases implemented and verified. `resolveThinkingLevel()` added to `LLMGateway`, threaded
into all four Vertex/Gemini call sites via `...(thinkingLevel != null ? { thinkingConfig:
{ thinkingLevel } } : {})`. Real, isolated (separate-process) A/B on the full engine against real
Postgres: 68% speedup (29,846ms -> 9,675ms) with markers intact. Existing tests re-run clean and
faster. Caught and correctly diagnosed a test-methodology bug (getLLMGateway()'s module-level
singleton) rather than accepting a misleading initial result.
