# Tests: Track 014 — Configurable Gemini thinking level

## Test Commands

```bash
node test-vertex-genai.js          # existing, must still pass
node test-stream-reporting.js      # existing, must still pass
node test-thinking-level.mjs       # write during Phase 3, not committed
```

## Test Cases

### Feature: Default resolution (Phase 1)
- [x] TC-1: No `llmThinkingLevel` set anywhere → resolves to `'MINIMAL'`. PASS
      (`resolveThinkingLevel(undefined)` on a gateway with `config: {}` returns `'MINIMAL'`).
- [x] TC-2: `config.llmThinkingLevel: null` → resolves to `null` (no `thinkingConfig` sent). PASS.
- [x] TC-3: `options.thinkingLevel: 'HIGH'` with `config.llmThinkingLevel: 'MINIMAL'` set →
      resolves to `'HIGH'` (per-call wins). PASS. Also verified the reverse (engine config used
      when no per-call override is given).

### Feature: Real speedup reproduction (Phase 3)
- [x] TC-4: Through the full engine (`TokenTalosEngine`, real Postgres, not raw `@google/genai`),
      on the same real representative prompt: `llmThinkingLevel: null` (old default) = 29,846ms;
      unset (new `MINIMAL` default) = 9,675ms — a **68% speedup**, reproducing the standalone
      finding through the actual plumbing. **Caught and fixed a test-methodology bug along the
      way**: `getLLMGateway()` is a module-level singleton — running both configs sequentially
      in one process silently reused the first config for both trials (a false "reversal" was
      observed and traced to this, not a defect in this track's logic). Correct A/B requires
      separate processes per config; not a defect introduced by this track, but a real
      pre-existing limitation worth knowing (a single Node process can only ever use the
      *first* config passed to `getLLMGateway()` — relevant to future testing, not to real
      consumers like coachai, which only ever construct one config per process).
- [x] TC-5: Marker compliance (`<<<DIAGRAM_START/END>>>`, `<<<TERMS_USED/END>>>`) intact in both
      the `null` and `MINIMAL` trials.

### Feature: No regression
- [x] TC-6: `test-vertex-genai.js` and `test-stream-reporting.js` both re-run clean — same
      correct behavior, faster timing (as expected, since neither sets `llmThinkingLevel` and
      both now get `MINIMAL` by default), and `test-vertex-genai.js`'s `usageMetadata` correctly
      shows no `thoughtsTokenCount` field (vs. 765-769 in every prior pre-Track-014 run of the
      identical test).

## Acceptance Criteria
- [x] TC-1 through TC-6 verified manually, including catching and resolving a real test-harness
      bug (the singleton gateway) rather than accepting a misleading result.
