# Spec: Track 012 — Structured (pino) logging for the engine layer

## Problem Statement

While investigating why Track 011's `streamExecute()` persist-failure catch block
(`lib/engine/index.js`) left no trace for a real ~76s call that completed successfully but never
wrote a `usage_data` row: the catch block's `console.warn(...)` had nowhere durable to go.
coachai's dev setup runs `node server/index.mjs | npx pinorama --open` — stdout is piped
straight into pinorama, which expects newline-delimited pino-formatted JSON. A plain-text
`console.warn` line either gets silently dropped or fails to parse; either way, it's
unrecoverable after the fact. A quick fallback-file patch was already added (writes to
`os.tmpdir()/tokentalos-stream-errors.log`) as a stopgap, but that's a narrow fix for one call
site, not a real fix for the package's logging story.

Confirmed via grep: `pino` is not a dependency anywhere in `package.json`, and every diagnostic
message in the engine layer is a plain `console.log`/`console.warn`/`console.error` call — 17
call sites across `lib/engine/index.js`, `lib/engine/llm_clients.js`, `lib/engine/db.js`,
`lib/engine/cache.js`, `lib/engine/ai_analyzer.js`, `lib/engine/tokenizers.js`, and `index.js`.

If tokentalos emitted real pino JSON to stdout instead, the exact same
`node ... | npx pinorama --open` pipe coachai already uses today would correctly parse, index,
and surface every one of these messages — no consumer-side change needed at all, since pino's
default output format IS newline-delimited JSON on stdout.

## Requirements

- REQ-1: Add `pino` as a runtime dependency.
- REQ-2: Create `lib/logger.js` exporting `getLogger()` — a lazily-created, module-level default
  pino instance (`pino({ name: 'tokentalos', level: process.env.TOKENTALOS_LOG_LEVEL || 'info' })`).
  Simple singleton, no external config file needed.
- REQ-3: `TokenTalosEngine`'s constructor accepts an optional `config.logger` (a pre-configured
  pino instance) — store as `this.logger`, falling back to `getLogger()` if not provided. This
  lets a consumer (e.g. coachai) inject its own pino instance so tokentalos's logs appear
  unified in the exact same stream as the consumer's own request logs, if desired. Not required
  — falls back cleanly to the shared default.
- REQ-4: `LLMGateway`'s constructor does the same (`config.logger || getLogger()`), since it's
  constructed with the same `config` object `TokenTalosEngine` receives.
- REQ-5: The top-level `TokenTalos` class (`index.js`) does the same for its own `_report()`
  catch block.
- REQ-6: `lib/engine/db.js`, `lib/engine/cache.js`, `lib/engine/ai_analyzer.js`,
  `lib/engine/tokenizers.js` are plain-function modules, not classes — these import
  `getLogger()` directly at module scope (no per-call config threading; not worth the churn for
  4 files with one or two log lines each).
- REQ-7: Convert all 17 existing `console.log`/`console.warn`/`console.error` call sites in the
  in-scope files to the equivalent `logger.info`/`logger.warn`/`logger.error` calls, preserving
  the same message content and any interpolated values (as structured fields where sensible,
  e.g. `logger.warn({ err }, 'message')` rather than string-concatenating the error into the
  message — matches coachai's own established pino convention per its CLAUDE.md).
- REQ-8: Track 011's persist-failure catch block (`lib/engine/index.js`) keeps its existing
  file-fallback (belt-and-suspenders — a persist failure is exactly the kind of thing worth
  defending in depth) but ALSO emits via `this.logger.error({...}, 'Failed to persist
  streamExecute usage')` with the same structured fields (usageId, endpoint, provider, model,
  durationMs, error name/message/stack) already written to the fallback file.
- REQ-9: No change to any function signature that would break existing callers — `config.logger`
  is purely additive/optional everywhere.

## Non-Goals

- `bin/tokentalos.js` (the CLI) — console output there IS the user-facing UI (progress messages,
  usage/export tables); converting to pino would make it worse, not better, for a human running
  the CLI directly. Explicitly out of scope.
- `api/*.js` (the standalone dashboard/collector server, run as its own process, not embedded in
  a consumer app like coachai) — different deployment story, own concern, not blocking this fix.
- Any change to log CONTENT/decisions beyond format (i.e. not adding new diagnostic messages,
  just converting existing ones — except REQ-8's addition, which is Track 011's own follow-up).
- Pretty-printing/transport configuration (e.g. `pino-pretty`) — the whole point is raw JSON on
  stdout for pinorama (or any other pino-aware viewer) to parse; a human reading raw JSON
  directly in a terminal is an accepted, minor readability cost outside this track's scope.

## Acceptance Criteria

- [ ] `pino` is a declared dependency; `npm ls @google-cloud/vertexai` (Track 010) and
      `npm ls pino` (this track) confirm the dependency tree is correct.
- [ ] All 17 identified call sites converted; `grep -rn "console\.\(log\|warn\|error\)"
      lib/engine/ index.js` (excluding `bin/` and `api/`) returns nothing.
- [ ] `TokenTalosEngine`/`LLMGateway`/`TokenTalos` all accept `config.logger` and fall back to
      the shared default cleanly when not provided (verified via a script, not just code review).
- [ ] Via the `npm link` symlink already in place (coachai → this repo), confirm from coachai's
      own dev setup that a real tokentalos log line (e.g. `getVertex()`'s "Initializing
      GoogleGenAI" message) now appears correctly in Pinorama's UI or at minimum as valid JSON in
      the piped stdout — the actual real-world proof this fix does what it's for.
- [ ] Existing behavior (quality-gate's 4 checks, `test-vertex-genai.js`,
      `test-stream-reporting.js`) all still pass — this is a logging-format change, not a
      behavior change, and must not regress anything.
