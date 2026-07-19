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

## Phase 4: Migrate the direct-Gemini-API path too (REQ-6) — not yet done

**File**: `lib/engine/llm_clients.js`

- [ ] `getGemini()`: replace `new GoogleGenerativeAI(apiKey)` with `new GoogleGenAI({ apiKey })`.
- [ ] `executeGemini()`/`streamExecuteGemini()`: same call-shape migration as Phase 2.
- [ ] Once both paths are migrated, remove `@google-cloud/vertexai` and `@google/generative-ai`
      from `package.json` dependencies entirely.
- Deferred behind Phase 5/6 since it doesn't affect coachai (no `GEMINI_API_KEY` configured
  there, always resolves to Vertex) and isn't blocking the real-world confirmation that matters.

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

## Phase 6: Publish + update coachai's dependency — not yet done

- [ ] Bump version (patch or minor per this repo's own convention).
- [ ] Confirm `LLMGateway`/`TokenTalos`'s public API surface is unchanged (REQ-7).
- [ ] `npm publish` — after Phase 5's real-world confirmation (done) and once Phase 4 is decided
      (bundle together, or ship Phase 2/3/5's fix first as its own patch release and do Phase 4
      separately — decide with the user before publishing).
- [ ] In coachai: update `package.json`'s `@meller/tokentalos` version range, `npm install`,
      confirm the *published* (not linked) package resolves, remove the `npm link`.
- [ ] Update `index.md` Progress/Phase/Summary as phases complete.
