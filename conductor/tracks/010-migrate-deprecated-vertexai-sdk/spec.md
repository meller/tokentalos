# Spec: Track 010 — Migrate off deprecated @google-cloud/vertexai SDK

## Problem Statement

`lib/engine/llm_clients.js` constructs its Vertex AI client via `@google-cloud/vertexai`'s
`VertexAI` class (`getVertex()`, line 2/62). Every real invocation of this path prints:

> "The VertexAI class and all its dependencies are deprecated as of June 24, 2025 and will be
> removed on June 24, 2026. Please use the Google Gen AI SDK
> (https://www.npmjs.com/package/@google/genai) to access Gemini features."

Today's date is 2026-07-19 — **we are ~1 month past the stated removal date.**

## Evidence (from the consumer app, coachai — full investigation there)

A consumer app (coachai) reported severe chat-response slowness. Investigation there:
- Ruled out every recent code commit as the cause — the backend process serving the slow
  requests had been running for 2.5+ days without restart, predating any recent commit.
- Reproduced the slowdown with a bare script calling `getTokenTalos().execute(...)` directly,
  completely bypassing the consumer app's request-handling code: a real guardrail-sized prompt
  (~1400 tokens) took 15-28 seconds when replayed just now, vs. historical latency for the same
  scale of prompt in the 1-2 second range.
- Confirmed it isn't a prompt-content/size regression: pulled the *exact* prompt content that
  historically ran in ~1200ms (2026-07-13) and replayed it right now — 5.7 seconds. Same content,
  same code, only the date changed.
- This isolates the regression to something between this package and Vertex AI's serving side —
  consistent with a deprecated, degraded SDK path rather than an app-level or content-level cause.

## Requirements

- REQ-1: Add `@google/genai` as a dependency (confirmed via Google's own migration guide as the
  intended replacement for both `@google-cloud/vertexai`'s `VertexAI` class and, more broadly,
  `@google/generative-ai`'s `GoogleGenerativeAI` class).
- REQ-2: Migrate `getVertex()` (`llm_clients.js`) to construct a `GoogleGenAI` client instead of
  `VertexAI`:
  ```javascript
  import { GoogleGenAI } from '@google/genai';
  const ai = new GoogleGenAI({ vertexai: true, project, location });
  ```
  Preserve the existing per-`project:location` caching behavior (`this.clients.vertex` Map) —
  this is a real optimization already in place (avoids reconstructing a client per call), not
  something to drop during migration.
- REQ-3: Migrate `executeVertex()` to the new SDK's call shape:
  ```javascript
  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config: { systemInstruction, temperature: options.temperature, maxOutputTokens: options.max_tokens },
  });
  ```
  Note the new SDK nests generation params under `config`, not top-level `generationConfig` —
  this is a real shape change, not just an import swap.
- REQ-4: Migrate `streamExecuteVertex()` similarly, to `ai.models.generateContentStream({...})`.
- REQ-5: **Verify the new SDK's response shape before assuming parity** — the old code's
  content-extraction logic (`executeVertex()`'s candidate/parts walk, lines 269-287, deliberately
  defensive because `response.text()` could throw on safety blocks) and usage-metadata extraction
  (`usageMetadata.promptTokenCount`/`candidatesTokenCount`) need to be re-verified against the
  new SDK's actual response object — Google's migration guide shows `response.text` as a plain
  property (not a method call) in its `generateContent` example, which may already differ from
  the old shape. Do not assume identical field names; check via a real call during implementation
  (Phase 2 of plan.md).
- REQ-6: **Same migration for the non-Vertex path** (`getGemini()`/`executeGemini()`/
  `streamExecuteGemini()`, currently on `@google/generative-ai`'s `GoogleGenerativeAI`) — lower
  priority (not the path causing today's production issue, since coachai has no `GEMINI_API_KEY`
  configured and always resolves to Vertex), but leaving two different Google SDKs live
  simultaneously in the same file is exactly the kind of inconsistency worth avoiding while
  already in this code. Do this in the same track, as a separate phase, not a blocking dependency
  of REQ-1-5.
- REQ-7: No change to the public `LLMGateway`/`TokenTalos` API surface (`execute`,
  `streamExecute`, `construct`) — this is purely an internal client-implementation swap; every
  consumer (coachai and any other project depending on this package) should see zero interface
  changes.

## Non-Goals

- Migrating the Anthropic/OpenAI/DeepSeek client paths — unrelated, not deprecated, not in scope.
- Any change to TokenTalos's own cost-tracking/pricing tables (Track 009's concern) — this track
  is purely about the client SDK, not pricing data.
- Any *code* change to coachai (the consumer) — once this package is published, coachai's
  existing `^1.1.0` dependency range picks it up with no code change (REQ-7). A *temporary*
  local-symlink test against coachai IS in scope (Phase 5) — that's verification, not a
  consumer-side change, and gets unwound before publishing.
- Diagnosing or fixing any *other* contributor to coachai's reported slowness beyond this SDK —
  this track removes the deprecated SDK regardless of whether that turns out to be the sole
  cause. If Phase 5's real-world test shows only partial recovery, a separate follow-up
  performance-investigation track in coachai is the right place for that, not this one.

## Acceptance Criteria

- [ ] `npm ls @google-cloud/vertexai` shows it's no longer a runtime dependency (or at minimum,
      no longer imported/constructed anywhere in `lib/engine/llm_clients.js`).
- [ ] No deprecation warning printed on a real Vertex call.
- [ ] A real `executeVertex()`/`streamExecuteVertex()` call returns the same shape
      (`{content, input_tokens, output_tokens, raw}`) with correct, non-zero token counts.
- [ ] Verified end-to-end from coachai via a temporary local symlink (not just this repo's own
      isolated tests) before publishing — the original bug was only ever visible from the
      consumer side, so this repo's tests alone aren't sufficient evidence of the fix.
- [ ] Explicitly recorded (in `index.md`, at completion) whether coachai's post-fix latency fully
      returned to the pre-regression baseline or only partially — this determines whether a
      separate coachai-side performance track is needed, and that determination belongs here,
      not left implicit.
- [ ] **The specific reproduction case from the investigation** — replaying the same
      ~1200-1400-token prompt that historically ran in ~1-2s — is re-measured post-migration and
      confirmed to no longer take 5-30+ seconds. This is the real-world signal that actually
      matters here, more than any unit-level check.
- [ ] `streamExecuteVertex()`'s streaming chunks still arrive incrementally (not buffered/batched
      into one final chunk) — confirm via a manual streamed call, since this is a user-facing
      latency property (time-to-first-token) that a careless migration could silently regress.
- [ ] Existing safety-block/empty-content handling (REQ-5's defensive extraction) still works —
      verify with a prompt likely to trigger a safety finish reason, if one can be constructed
      safely for testing purposes.
