# Track 010: Plan

## Phase 0: Root cause + migration guide — done 2026-07-19

- [x] Reproduced the regression from the consumer app's investigation (coachai), ruling out
      app-level/commit-level causes via direct replay against this package, bypassing the app.
- [x] Fetched Google's own migration guide (`@google-cloud/vertexai` → `@google/genai`) to ground
      the exact new-SDK shape rather than guess at it.

## Phase 1: Add the new SDK dependency — ✅ DONE

- [x] `npm install @google/genai` (installed `^2.12.0`).
- [x] Kept `@google-cloud/vertexai` and `@google/generative-ai` in `package.json` for now —
      Phase 4 (Gemini-direct path) hasn't migrated yet; removing both happens together once it
      does (avoids a half-migrated state).

## Phase 2: Migrate the Vertex path (REQ-2/3/4/5) — ✅ DONE

**File**: `lib/engine/llm_clients.js`

- [x] `getVertex()`: now constructs `new GoogleGenAI({ vertexai: true, project, location })`.
      `this.clients.vertex` Map cache keyed by `project:location` unchanged.
- [x] `executeVertex()`: migrated to `ai.models.generateContent({model, contents, config: {...}})`.
      **Verified real response shape via an actual call** (not assumed): `response.text` is
      indeed a plain property (matches the migration guide); `response.candidates[].content.parts[]`
      structure is unchanged; `response.usageMetadata.promptTokenCount`/`candidatesTokenCount`
      unchanged. Defensive empty-content/finishReason handling preserved as-is.
- [x] `streamExecuteVertex()`: migrated to `ai.models.generateContentStream({...})` — the return
      value is itself the async-iterable (no `.stream` wrapper, unlike the old SDK).
      **Investigated the streaming-regression risk flagged in spec.md (TC-8)**: a real streamed
      call only yielded 1-2 chunks with ~90% of total time elapsed before the first chunk. Ruled
      out as a migration regression by A/B testing the *old* SDK with the identical prompt — it
      showed the same poor chunking (3 chunks, 6.1s of 6.7s before the first chunk). This is
      pre-existing behavior (likely `gemini-3.5-flash`'s internal "thinking" phase consuming time
      before any visible token emits), present identically in both SDKs, not something this
      migration introduced or worsened.
- [x] Manual verification via `test-vertex-genai.js` (kept, matching the `test-model.js`
      convention) — real `executeVertex`/`streamExecuteVertex` calls, sane content/token counts.

## Phase 3: Re-run the exact reproduction case (in this repo, isolated) — ✅ DONE

- [x] Replayed a real ~5230-char guardrail prompt (pulled from coachai's `tokentalos.usage_data`
      table) through the migrated `executeVertex()`, isolated in this repo: **3.5-5.0 seconds**
      across 3 runs — down from 15-28 seconds pre-migration for the same class of prompt. No
      deprecation warning printed.

## Phase 4: Migrate the direct-Gemini-API path too (REQ-6) — ✅ DONE 2026-07-19

**File**: `lib/engine/llm_clients.js`

- [x] `getGemini()`: replaced `new GoogleGenerativeAI(apiKey)` with `new GoogleGenAI({ apiKey })`.
- [x] `executeGemini()`/`streamExecuteGemini()`: same call-shape migration as Phase 2
      (`config` nesting, `ai.models.generateContent(Stream)`, defensive text extraction).
- [x] **Scope addition found during this phase**: `lib/engine/ai_analyzer.js` (the
      `explain_plans` heuristic-analysis feature) was a second, previously-unnoticed consumer of
      the deprecated `@google/generative-ai` SDK — not mentioned in the original spec, but
      removing the package would have silently broken it. Migrated it to the same `@google/genai`
      shape. Also updated `test-model.js` (a pre-existing manual script) for consistency.
- [x] Removed `@google-cloud/vertexai` and `@google/generative-ai` from `package.json`
      (`npm uninstall`) — confirmed zero remaining imports of either package anywhere in the repo
      (`api/package.json` still lists `@google/generative-ai` but has zero actual imports of it —
      a separate, unused stray dependency in a different sub-package; left alone as out of scope).
- [x] **Real bug caught by the uninstall**: `google-auth-library` (imported directly by
      `getVertex()`'s ADC project-ID auto-detection) was never declared as a direct dependency in
      `package.json` — it only resolved because `@google-cloud/vertexai` pulled it in
      transitively. Removing that package broke the import (`ERR_MODULE_NOT_FOUND`) immediately,
      caught by re-running the quality-gate's Import Check. Fixed by adding it as an explicit
      direct dependency (`npm install google-auth-library`, resolved `^10.9.0`, already present
      elsewhere in the tree).
- [x] Re-ran quality-gate checks (build, import check, CLI smoke test) plus both `test.md` scripts
      (`test-vertex-genai.js`, `test-stream-reporting.js`) — all green post-migration.

## Phase 5: Test end-to-end from coachai via a local symlink — ✅ DONE

- [x] `npm link` in this repo, `npm link @meller/tokentalos` in coachai —
      `coachai/node_modules/@meller/tokentalos` now resolves to this working tree.
- [x] Killed both stray/active coachai backend processes (one orphaned, one live on :8001) at the
      user's explicit direction, user restarted the dev server fresh.
- [x] Confirmed the linked code is actually loaded: coachai's logs show
      `"Initializing GoogleGenAI (Vertex mode) client"` (the new migration's own log line), no
      deprecation warning.
- [x] Re-ran the reproduction through coachai's own `getTokenTalos()` wrapper (not just the raw
      gateway) — **8.5-9.7 seconds** across 3 runs, for the same real prompt.
- [x] **Recorded full vs. partial recovery, explicitly**: **PARTIAL.** Historical baseline
      (2026-07-13, full coachai pipeline) was ~1.2s. Pre-fix regression was 15-28s. Post-fix,
      through coachai's full pipeline, it's 8.5-9.7s — a genuine ~60-70% improvement, but still
      roughly 7x slower than the historical baseline. The gap between this repo's isolated test
      (3.5-5.0s) and coachai's full-pipeline test (8.5-9.7s) points at TokenTalos's own engine
      processing (`formattingFeatures: ['compress','pii','neutralize']`,
      `intelligenceFeatures: ['cache']`, plus a usage-tracking DB write per call) as a plausible
      separate, additional contributor — not the deprecated SDK, which this track already fixed.
      **Conclusion: this migration is real, substantial, and being kept regardless — but does
      NOT fully explain coachai's reported slowness. A separate coachai-side performance
      investigation track is warranted for the remaining gap** (per spec.md's Non-Goals — that
      investigation is out of this track's scope).
- [ ] Unlink coachai back to normal dependency resolution — **not yet done**, holding the symlink
      in place in case the follow-up coachai performance track wants to keep testing against this
      same in-progress code before Phase 6's publish.

## Phase 5b: Re-examine the "engine overhead" hypothesis using Track 011's new visibility — done 2026-07-19

Track 011 (`streamExecute()` usage reporting) shipped after Phase 5, closing the exact
observability gap Phase 5 ran into — `chat_stream` calls had never produced a `usage_data` row
before, so Phase 5's "engine overhead" theory was an inference from an isolated-vs-wrapped time
delta, not a direct measurement. With Track 011 live, re-ran the same class of real prompt
(6034-char sample pulled from `tokentalos.usage_data`, same one used in Phase 3) through
coachai's actual `getTokenTalos()` wrapper twice, restarting coachai's backend first to load
Phase 4's changes:

- **First `chat_stream` row ever recorded** (the original motivating gap, now closed):
  `latency_ms: 7817`, `input_tokens: 1515`, `output_tokens: 67` — and this `latency_ms` matched
  the calling script's own measured wall-clock (7824ms) to within 7ms, confirming the
  persistence `finally` block adds no measurable overhead (re-confirms Track 011's TC-4/TC-6 on
  real, non-synthetic traffic).
- **Directly timed `tt.engine.process(parts)`** (the PII/compress/neutralize step Phase 5
  suspected as the missing overhead) in isolation: **1ms**. This rules out engine-side prompt
  processing as a meaningful contributor — it's negligible, not the multi-second gap Phase 5
  hypothesized.
- **Immediately re-ran the identical call**: 9018ms — a **1.2s swing between two back-to-back
  calls with byte-identical input**, with `process()` again taking ~1ms.
- **Revised conclusion**: Phase 5's "TokenTalos engine overhead" hypothesis is **not supported**
  by direct measurement — `process()` is ~1ms, and streaming calls don't hit the cache path at
  all (REQ-4 explicitly excludes cache from `streamExecute()`, so there's no cache-check
  overhead either). The ~7-9s is essentially all real LLM call time, and it swings by over a
  second between identical consecutive calls — consistent with this session's earlier, separate
  finding that `gemini-3.5-flash` is a "thinking" model whose internal reasoning-token budget
  (seen elsewhere this session ranging 257-769 tokens) varies run-to-run and dominates latency
  before any visible output. **This migration (Track 010) and the reporting fix (Track 011) are
  both complete and correct; the remaining gap vs. the ~1.2s historical baseline is not a code
  defect in either package — it's inherent to using a thinking-enabled model for this latency-
  sensitive path.** Any further work here is a coachai-side product/model decision (e.g.
  reconsider `gemini-3.5-flash` vs. a non-thinking model for the streaming chat path, or accept
  the trade-off given the response-quality gains already A/B-tested for this model — see
  coachai's `tokentalos.mjs` comment), not a tokentalos code fix.

## ✅ REVIEWED — 2026-07-19

See `conversation.md` for the full review. Verdict: PASS, no gaps (TC-12 honestly flagged as
code-reviewed-but-not-live-tested, no API key available). Proceeding to quality-gate.

## ✅ QUALITY PASSED — 2026-07-19

All `conductor/quality-gate.md` checks executed and passed: Build, Unit Tests (SKIP, none
exist), Import Check, CLI Smoke Test. Track-specific checks (`test.md`): `test-vertex-genai.js`
and `test-stream-reporting.js` both re-run clean post-Phase-4. `npm ls @google-cloud/vertexai
@google/generative-ai` confirmed empty. Secrets scan: no hardcoded credentials.

## Phase 6: Publish + update coachai's dependency — not yet done (pending user decision)

- [ ] Bump version (patch or minor per this repo's own convention).
- [x] Confirm `LLMGateway`/`TokenTalos`'s public API surface is unchanged (REQ-7) — confirmed in
      review.
- [ ] `npm publish` — Phases 1-5b are all done and quality-gated. **Holding off on the actual
      `npm publish` and coachai dependency switch pending explicit user go-ahead** — this is a
      real, externally-visible action (and this repo's `publishConfig` targets the public npm
      registry), not something to do unilaterally as part of routine track completion.
- [ ] In coachai: update `package.json`'s `@meller/tokentalos` version range, `npm install`,
      confirm the *published* (not linked) package resolves, remove the `npm link`.
- [ ] Update `index.md` Progress/Phase/Summary as phases complete.
