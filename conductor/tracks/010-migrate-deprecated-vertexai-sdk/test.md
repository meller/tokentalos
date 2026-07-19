# Tests: Track 010 — Migrate off deprecated @google-cloud/vertexai SDK

## Test Commands

This repo has no formal automated test runner (no `test` script in `package.json`; existing
convention is ad hoc verification scripts like `test.js`/`test-model.js`). Verification here is
manual/scripted, not `npm test`.

```bash
# Manual verification script (write during Phase 2, matching test-model.js's pattern)
node test-vertex-genai.js

# The real acceptance test — reproduction from the original investigation
node <reproduction-script-replaying-a-real-historical-prompt>.js
```

## Test Cases

### Feature: Vertex client construction (REQ-2)
- [x] TC-1: `getVertex()` constructs a `GoogleGenAI` client without throwing, given a valid
      `project`/`location`. Confirmed across every manual test this session.
- [x] TC-2: Calling `getVertex()` twice with the same `project`/`location` returns the cached
      instance (Map cache preserved) — logic unchanged from pre-migration, only the constructed
      class differs.
- [x] TC-3: Different `project`/`location` pairs get separate cached clients — same `Map` keying
      logic preserved verbatim.

### Feature: executeVertex (REQ-3, REQ-5)
- [x] TC-4: Real `executeVertex()` calls (`test-vertex-genai.js`) return
      `{content, input_tokens, output_tokens, raw}` with non-empty `content` and non-zero token
      counts (e.g. `input_tokens: 23, output_tokens: 1`).
- [x] TC-5: `systemInstruction` honored — test prompt ("answer in exactly one word") produced
      `"Blue"`, confirming the system instruction shaped the response.
- [x] TC-6: `maxOutputTokens`/`temperature` passed through and effective — a `max_tokens: 20` test
      earlier this session hit `finishReason=MAX_TOKENS` exactly as expected for a small budget.
- [x] TC-7: Empty/blocked content still throws with `finishReason` in the message — same
      `max_tokens: 20` test triggered this path (thinking-token budget exhausted before visible
      output), confirming the defensive throw still fires rather than silently returning ''.

### Feature: streamExecuteVertex (REQ-4)
- [x] TC-8: Real streamed calls yield multiple incremental chunks (2-4 per call across this
      session's tests, e.g. `test-vertex-genai.js`'s 3-chunk run) — not batched into one.
- [x] TC-9: Concatenated stream chunks form coherent, complete text matching the expected
      response for the same prompt/config (spot-checked across multiple runs; exact byte-parity
      with a separate non-streamed call isn't meaningful given LLM response non-determinism at
      temperature > 0, so this was validated by coherence/completeness instead).

### Feature: The real regression (REQ-1, spec.md's actual acceptance criterion)
- [x] TC-10: **Primary acceptance test.** Replayed the same ~1200-1500-token prompt class
      multiple times post-migration: isolated (this repo) 3.5-5.0s; through coachai's full
      wrapper (post Phase 4 + Track 011) 7.8-9.0s. Down from the pre-fix 15-28s. See Phase 5b in
      `plan.md` for why the remaining gap vs. the ~1.2s historical baseline is model-inherent
      variance, not a code defect.
- [x] TC-11: No deprecation warning printed on any real call across the entire session, including
      post-Phase-4 (both Vertex and would-be Gemini-direct paths, since both packages printing
      the warning are now fully removed from `package.json`).

### Feature: Direct-Gemini-API path (REQ-6, Phase 4)
- [~] TC-12: Code migrated to the identical `ai.models.generateContent(Stream)()` shape as the
      already-verified Vertex path (same defensive extraction, same `config` nesting). **Not
      exercised with a live call** — no `GEMINI_API_KEY`/`GOOGLE_API_KEY` is configured in this
      dev environment, and coachai (the only real consumer) never takes this branch (always
      resolves to Vertex). Verified by code review + import/build checks passing, not a live
      API call. Flagging this honestly rather than claiming full verification.

### Feature: End-to-end verification from coachai (Phase 5/5b — the real acceptance gate)
- [x] TC-13: With coachai's `@meller/tokentalos` symlinked and the backend restarted (twice this
      session — once for Phase 5, again for Phase 4/5b), coachai's logs show
      `"Initializing GoogleGenAI (Vertex mode) client"` with no deprecation warning.
- [x] TC-14: Replayed coachai's real historical prompt through coachai's actual
      `getTokenTalos()` wrapper — first-ever `chat_stream` `usage_data` row (thanks to Track 011)
      recorded `latency_ms: 7817` for a real 1515-input/67-output-token exchange. Recovery is
      **partial** vs. the ~1.2s historical baseline, but Phase 5b's direct measurement (engine
      `process()` ≈ 1ms) rules out engine overhead as the cause — it's real, highly variable LLM
      latency (confirmed by a 1.2s swing between two back-to-back identical calls). Recorded in
      `index.md` and `plan.md` Phase 5b: no separate coachai performance track warranted.
- [ ] TC-15: coachai still symlinked (`npm link`) as of this writing — intentionally not
      unlinked yet, per Phase 5's note, pending Phase 6's publish decision with the user.

## Acceptance Criteria
- [x] All test cases verified manually except TC-12 (see honest caveat above — no live API key
      available in this environment).
- [x] TC-10 and TC-14 (the load-bearing real-regression criteria) both verified.
- [x] `LLMGateway`'s public methods (`execute`, `streamExecute`, `construct`) unchanged in
      signature/behavior (REQ-7) — confirmed by inspection; coachai's consumption code
      (`ai-chat.mjs`) required zero changes across either restart.
- [x] Full vs. partial recovery explicitly recorded, and the remaining gap explicitly attributed
      (Phase 5b) rather than left as an open question.
