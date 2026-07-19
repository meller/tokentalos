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
- [ ] TC-1: `getVertex()` constructs a `GoogleGenAI` client without throwing, given a valid
      `project`/`location`.
- [ ] TC-2: Calling `getVertex()` twice with the same `project`/`location` returns the cached
      instance (Map cache preserved), not a new client each time.
- [ ] TC-3: Different `project`/`location` pairs get separate cached clients.

### Feature: executeVertex (REQ-3, REQ-5)
- [ ] TC-4: A real `executeVertex()` call with a simple prompt returns
      `{content, input_tokens, output_tokens, raw}` with non-empty `content` and non-zero token
      counts.
- [ ] TC-5: `systemInstruction` is actually honored (a prompt distinguishing system vs. user
      content produces a response consistent with the system instruction — e.g. a system
      instruction demanding a specific output format).
- [ ] TC-6: `temperature`/`maxOutputTokens` options are actually passed through and have an
      effect (e.g. `maxOutputTokens: 5` visibly truncates a normally-longer response).
- [ ] TC-7: Empty/blocked content still throws with the `finishReason` in the message, matching
      existing defensive behavior — doesn't silently return empty content.

### Feature: streamExecuteVertex (REQ-4)
- [ ] TC-8: A real streamed call yields multiple incremental chunks (not one giant final chunk)
      — confirms time-to-first-token isn't regressed by the migration.
- [ ] TC-9: Concatenated stream chunks equal what a non-streamed `executeVertex()` call with the
      same prompt would return (content parity between streamed and non-streamed paths).

### Feature: The real regression (REQ-1, spec.md's actual acceptance criterion)
- [ ] TC-10: **Primary acceptance test.** Replay the same class of prompt used in the original
      investigation (a realistic ~1200-1400 token prompt) through the migrated code path.
      Latency should be back in the 1-3 second range, not 5-30+ seconds. This is the only test
      case that actually validates the fix did what it was for — the unit-level checks above
      confirm correctness, not performance.
- [ ] TC-11: No "VertexAI class ... deprecated" (or equivalent `@google/generative-ai`
      deprecation, post-Phase 4) warning printed on any real call.

### Feature: Direct-Gemini-API path (REQ-6, Phase 4)
- [ ] TC-12: `getGemini()`/`executeGemini()`/`streamExecuteGemini()` work identically post-
      migration for a project that has `GEMINI_API_KEY`/`GOOGLE_API_KEY` set (coachai itself
      doesn't exercise this path today, but other TokenTalos consumers might).

### Feature: End-to-end verification from coachai (Phase 5 — the real acceptance gate)
- [ ] TC-13: With coachai's `@meller/tokentalos` temporarily symlinked to this working tree and
      the backend restarted, coachai's own chat requests (not this repo's isolated test) show
      the migrated code path being exercised (e.g. no deprecation warning in coachai's logs).
- [ ] TC-14: Replaying coachai's original historical prompt (the same one used to diagnose this)
      through coachai's real request path — record the actual latency and compare against the
      pre-regression baseline (~400-2000ms per coachai's own investigation). Record in Track
      010's `index.md` whether recovery is full or partial — partial recovery means something
      else is also contributing and should become a separate coachai-side track, not silently
      absorbed into this one.
- [ ] TC-15: coachai unlinked back to normal dependency resolution once TC-13/14 are recorded —
      confirm `node_modules/@meller/tokentalos` is no longer a symlink before considering this
      phase done.

## Acceptance Criteria
- [ ] All test cases above verified manually (no automated suite exists in this repo).
- [ ] TC-10 (the real regression, isolated) and TC-14 (the real regression, from coachai
      end-to-end) are the load-bearing criteria — do not consider this track done without both,
      regardless of how clean the unit-level checks look.
- [ ] `LLMGateway`'s public methods (`execute`, `streamExecute`, `construct`) unchanged in
      signature/behavior from a consumer's perspective (REQ-7).
- [ ] Full vs. partial recovery explicitly recorded — not left ambiguous.
