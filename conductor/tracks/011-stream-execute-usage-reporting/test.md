# Tests: Track 011 — streamExecute() usage reporting

## Test Commands

No formal test runner in this repo — manual verification scripts, matching `test.js`/
`test-model.js`/Track 010's `test-vertex-genai.js` convention.

```bash
node test-stream-reporting.js   # write during Phase 4
```

## Test Cases

### Feature: Content accumulation + usage tracking (Phase 1)
- [x] TC-1: Consuming a full stream via `streamExecute()` yields the same total text a
      non-streamed `execute()` call with identical `parts` would return. Verified via
      `test-stream-reporting.js`: accumulated `full text` matched the concatenation of all
      yielded chunks exactly (no dropped/duplicated text at chunk boundaries).
- [x] TC-2: The tracked usage metadata after the stream ends has non-zero
      `promptTokenCount`/`candidatesTokenCount`. **Found and fixed a real bug here**:
      `streamExecuteVertex()`'s original chunk-forwarding only yielded when `text` was
      non-empty, but the final chunk (the one carrying `usageMetadata`) can have *no* text
      (e.g. `finishReason=MAX_TOKENS` with nothing left to emit) — so usage was silently lost.
      Fixed by yielding whenever `text || chunk.usageMetadata` (`lib/engine/llm_clients.js`).
      Confirmed after fix: `input_tokens: 27, output_tokens: 11, total_tokens: 38` persisted.

### Feature: Persistence (Phase 2)
- [x] TC-3: After a real streamed call completes, exactly one new `usage_data` row exists with
      `type: 'execution'`, `full_prompt` matching what was sent (`prompt_len: 121`),
      `response_content` matching the accumulated stream (`response_len: 51`), and correct
      `input_tokens`/`output_tokens`/`total_tokens`.
- [x] TC-4: `latency_ms` (4271ms) matched the measured wall-clock total time (4285ms) — not 0,
      not time-to-first-chunk only.
- [x] TC-5: `prompt_variables` rows exist for that `usage_data.id` (`system`: 14 tokens,
      `user_query`: 13 tokens).
- [x] TC-6: Chunk delivery remained incremental (2 chunks, first chunk at 3679ms of 4285ms total)
      — consistent with Track 010's finding that most latency is pre-first-chunk "thinking" time
      for this model, not something this change introduced.

### Feature: Error handling (Phase 3, best-effort)
- [x] TC-7: Forced a real error (bogus model name) — the original API error still propagated to
      the caller via the `catch` block (not swallowed), and the `finally` block still persisted a
      best-effort `usage_data` row (`input_tokens: 0, output_tokens: 0, response_content: ''`)
      rather than losing the attempt silently.

### Feature: End-to-end from coachai (Phase 4, after this ships)
- [ ] TC-8: A real chat message through coachai's `/api/ai/chat/stream` produces a queryable
      `tokentalos.usage_data` row for `endpoint = 'chat_stream'` — the original motivating gap.
      Not yet run — requires coachai's `@meller/tokentalos` dependency to pick up this fix
      (via `npm link` for now, published version later).

## Acceptance Criteria
- [x] TC-1 through TC-6 verified manually via `test-stream-reporting.js`.
- [x] TC-7 verified (not just attempted) — error propagation and best-effort persistence both
      confirmed working.
- [ ] TC-8 verified once coachai's tokentalos dependency includes this fix.
