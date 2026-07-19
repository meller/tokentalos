# Track 011: Plan

## Phase 0: Re-grounding against current code — done 2026-07-19

- [x] Re-read the actual `execute()` persistence sequence in `lib/engine/index.js:95-290` in full
      (coachai's original Track 067 sketch was directionally right but hadn't seen this much
      detail — it's ~5 different DB writes plus heuristic analysis, not one `_report()` call).
- [x] Confirmed the local Postgres `tokentalos.usage_data` table (what's actually queried for
      debugging) is written by the **engine's own** `execute()` (`lib/engine/index.js`), not by
      the top-level `TokenTalos` class's `_report()` (`index.js`) — that's a separate mechanism
      reporting to an external HTTP collector (`reportUrl`), orthogonal to this track's goal.
      So the real fix belongs in `lib/engine/index.js`'s `streamExecute()`, not `index.js`'s.
- [x] Live-verified (during Track 010's work) that streamed chunks only carry full
      `usageMetadata` on the last chunk — informs REQ-2's implementation.

## Phase 1: Accumulate content + track usage across the stream — done 2026-07-19

**File**: `lib/engine/index.js`, `streamExecute()` (currently lines 292-317)

- [x] Capture `const startTime = Date.now()` before building the prompt (matching `execute()`'s
      own pattern at line 96).
- [x] Wrap the `yield* gateway.streamExecute(...)` loop as an explicit `for await...yield` (not a
      `yield*` delegation, since we need to intercept each chunk to accumulate it) — accumulate
      `fullResponse += chunk`.
- [x] Track `usageMetadata`: after each chunk, if the underlying gateway exposes usage info on
      that chunk, keep the most recent non-empty one — overwrite a `lastUsage` variable whenever
      a chunk has real token counts (`promptTokenCount`/`candidatesTokenCount`).
  - **Plumbing decision**: `gateway.streamExecute()` (`lib/engine/llm_clients.js`) now yields
    `{text, usageMetadata}` objects instead of bare strings, across all three stream methods
    (`streamExecuteVertex`, `streamExecuteGemini`'s direct-API path, `streamExecuteOpenAI` — the
    latter also now requests `stream_options: { include_usage: true }` from the OpenAI API).
    `lib/engine/index.js`'s `streamExecute()` unwraps this internally and still yields plain
    text strings onward to its own caller — the public `TokenTalos.streamExecute()` contract
    (REQ-5) is unchanged.
  - **Bug found and fixed during verification**: `streamExecuteVertex()` originally only
    `yield`ed when `text` was non-empty, but the chunk carrying `usageMetadata` can have *no*
    text (`finishReason=MAX_TOKENS` with nothing left to emit) — this silently dropped all
    usage data. Fixed to yield whenever `text || chunk.usageMetadata`.

## Phase 2: Persist once the stream completes (REQ-3) — done 2026-07-19

**File**: same, in a `finally` block wrapping the accumulation loop

- [x] Once the stream is exhausted (or errors — REQ-6), compute `latencyMs = Date.now() -
      startTime`, cost via the same `getCostCalculator()` call `execute()` uses, and insert one
      `usage_data` row — same columns/shape as `execute()`'s non-cache-hit insert (lines 200-207),
      `type: 'execution'`, `full_prompt: fullPromptString`, `response_content: fullResponse`,
      tokens from the tracked `usageMetadata` (Phase 1).
- [x] Insert `prompt_variables` rows for `trackingData.variables`, same as `execute()`
      (lines 209-214).
- [x] Explicitly skip (Phase 4/REQ-4, deferred): cache read/write, `variable_actions`,
      `security_alerts`, `explain_plans` — documented in a code comment.
- [x] `finally` block's DB writes happen after the last chunk is yielded — verified no added
      latency to chunk delivery (see Phase 4 timing results below).
- [x] Fixed an off-by-one bug caught during manual testing: the `usage_data` INSERT's column
      list had 18 columns but the `VALUES` clause had 19 `?` placeholders (Postgres error:
      "INSERT has more expressions than target columns").

## Phase 3: Handle the aborted/error case (REQ-6, best-effort) — done 2026-07-19

- [x] Verified with a forced error (bogus model name): the original error still propagates to
      the caller (not swallowed), and the `finally` block persists a best-effort row
      (`input_tokens: 0, output_tokens: 0, response_content: ''`) rather than losing the attempt.

## Phase 4: Verify end-to-end — Phases 1-7/8 done 2026-07-19, TC-8 pending

- [x] Manual test `test-stream-reporting.js` (kept, matches repo convention): calls
      `TokenTalos.streamExecute(...)` (top-level class) with a real prompt, consumes the stream
      fully, then queries `tokentalos.usage_data` directly — confirmed a new row with sane
      `full_prompt`/`response_content`/tokens/`latency_ms`.
- [x] Confirmed chunk delivery is still incremental (2 chunks; first chunk at 3679ms of 4285ms
      total — consistent with Track 010's "thinking model" finding, not a regression).
- [ ] Once shipped and coachai's dependency is updated (after Track 010's Phase 6 publish, or
      bundled into the same release — decide together): confirm from coachai's side that a real
      `/api/ai/chat/stream` call now produces a `usage_data` row for `endpoint = 'chat_stream'`.
- [x] Update `index.md` Progress/Phase/Summary as phases complete.

## ✅ REVIEWED — 2026-07-19

See `conversation.md` for the full review. Verdict: PASS, no gaps. Proceeding to quality-gate.

## ✅ QUALITY PASSED — 2026-07-19

All `conductor/quality-gate.md` checks executed and passed:
- **Build**: `npm run build` — exits 0, `api/public/` populated with built dashboard assets.
- **Unit Tests**: `node --test lib/**/*.test.js` — no test files exist, SKIP (per quality-gate.md
  rule).
- **Import Check**: `node -e "import('./index.js')..."` — exits 0.
- **CLI Smoke Test**: `node bin/tokentalos.js --help` — exits 0, prints usage.

Track-specific check (`test.md`): `node test-stream-reporting.js` re-run clean — same result as
review (2 chunks, `input_tokens: 27`, `output_tokens: 11`, `latency_ms` ≈ wall-clock). Test row
deleted from `usage_data` after verification.

Secrets scan: no hardcoded credentials in the diff; `.gitignore` already covers `.env*`.

## Note: relationship to Track 010

This track and Track 010 (migrate off deprecated VertexAI SDK) touch adjacent but distinct
layers — Track 010 is `lib/engine/llm_clients.js` (the raw provider client), this track is
`lib/engine/index.js` (the engine's prompt-building/persistence wrapper one level up). Both are
in-flight in the same repo; land Track 010 first (already further along) since Phase 1 of this
track depends on deciding how `gateway.streamExecute()` exposes usage metadata, which touches the
same file Track 010 already modified.
