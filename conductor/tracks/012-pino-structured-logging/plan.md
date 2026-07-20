# Track 012: Plan

## Phase 1: Add pino + shared logger module

- [x] `npm install pino`.
- [x] Create `lib/logger.js`:
  ```js
  import pino from 'pino';
  let defaultLogger = null;
  export function getLogger() {
    if (!defaultLogger) {
      defaultLogger = pino({ name: 'tokentalos', level: process.env.TOKENTALOS_LOG_LEVEL || 'info' });
    }
    return defaultLogger;
  }
  ```

## Phase 2: Thread `config.logger` through the class-based entry points

- [x] `TokenTalosEngine` constructor (`lib/engine/index.js`): `this.logger = this.config.logger
      || getLogger();`
- [x] `LLMGateway` constructor (`lib/engine/llm_clients.js`): `this.logger = config.logger ||
      getLogger();`
- [x] `TokenTalos` constructor (`index.js`): `this.logger = options.config?.logger || getLogger();`

## Phase 3: Convert all 17 call sites

**File-by-file** (from the grep in spec.md):
- [x] `lib/engine/index.js` (2 sites: the Track 011 persist-failure warn — see Phase 4 below —
      handled separately since it also needs the structured-fields treatment).
- [x] `lib/engine/ai_analyzer.js` (2 sites: JSON parse warn, general error).
- [x] `lib/engine/cache.js` (1 site: empty-response-content warn).
- [x] `lib/engine/db.js` (4 sites: SQLite/Postgres init logs — keep as `logger.info` since these
      are genuinely informational startup messages, not warnings; search-path-on-connect error;
      migration-check-failed warn). Import `getLogger()` directly at module scope.
- [x] `lib/engine/llm_clients.js` (7 sites: ADC auto-detect info/warn, missing-project-id warn,
      Vertex-client-init info, Gemini/Vertex execution errors, safety-block-finishReason warn).
- [x] `lib/engine/tokenizers.js` (1 site: token-counting-failed warn).
- [x] `index.js` (1 site: `_report()`'s failed-to-report-to-collector warn).
- [x] Preserve message content; move interpolated error objects into structured fields
      (`logger.warn({ err }, 'message')`) rather than string concatenation, per REQ-7.

## Phase 4: Track 011's persist-failure block gets the logger too (REQ-8)

**File**: `lib/engine/index.js`, the `catch (persistErr)` block added in Track 011's follow-up

- [x] Keep the existing file-fallback append (defense in depth).
- [x] Add `this.logger.error({ usageId: trackingData?.id, endpoint, provider: finalProvider,
      model: finalModel, durationMs: Date.now() - startTime, err: persistErr }, 'Failed to
      persist streamExecute usage')` alongside it.

## Phase 5: Verify

- [x] `node --check` on every touched file.
- [x] Confirm `grep -rn "console\.\(log\|warn\|error\)" lib/engine/ index.js` returns nothing
      (excluding `bin/`, `api/`, `node_modules`).
- [x] Re-run the quality-gate's 4 checks (build, unit tests/skip, import check, CLI smoke test)
      and both existing test scripts (`test-vertex-genai.js`, `test-stream-reporting.js`) —
      confirm no behavior regression.
- [x] From coachai (already `npm link`ed to this repo): trigger a real tokentalos call and
      confirm the resulting log line is valid, parseable pino JSON on stdout — the real proof
      this solves the original observability gap.
- [x] Update `index.md` Progress/Phase/Summary as phases complete.

## Note: relationship to Track 011

This track exists because of a gap Track 011's own persist-failure handling exposed — a real
~76s call's `usage_data` persistence failed silently with no recoverable trace. This track makes
that failure (and every other engine-level diagnostic) properly observable going forward; it
does not itself explain *why* that specific persist attempt failed — that's the next step
(reproduce live) once this ships.
