# Spec: Track 011 — streamExecute() usage reporting

## Problem Statement

`execute()` (`lib/engine/index.js:95-290`) does substantial work after the LLM call resolves:
computes latency/cost, inserts one `usage_data` row, inserts `prompt_variables` rows (one per
tracked variable), inserts `variable_actions` rows, inserts `security_alerts` rows, runs
heuristic analysis and conditionally inserts an `explain_plans` row, and writes to cache
(`this.cache.set`). It also checks the cache *before* calling the LLM and logs a `cache_hit`-typed
`usage_data` row if found.

`streamExecute()` (`lib/engine/index.js:292-317`) does none of this — it's a plain pass-through:
```js
async *streamExecute(params) {
  // ...builds the same prompt as execute()...
  yield* gateway.streamExecute(finalProvider, finalModel, messages, {...});
}
```
No accumulation of yielded content, no cache check, no `usage_data`/`prompt_variables`/etc. writes
at all. Every consumer that streams (which is the primary interaction mode for a chat product)
gets zero queryable history for those calls — confirmed from coachai's side: `usage_data` has
~1470+ rows for every endpoint that uses `execute()`, and **zero** for `chat_stream`/
`chat_response` (coachai's streaming chat endpoints).

## Confirmed implementation detail (live-verified during Track 010)

A real streamed Vertex call's chunks carry `usageMetadata` **only on the final chunk** — earlier
chunks have an empty/traffic-type-only `usageMetadata`. The last chunk's `usageMetadata` includes
`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`, and (for "thinking" models)
`thoughtsTokenCount`. This means: accumulate content across all chunks, but only trust/persist
token counts from whichever chunk had the fullest `usageMetadata` seen (in practice, the last one).

## Requirements

- REQ-1: `streamExecute()` accumulates the full response text as chunks are yielded (`fullResponse
  += chunk`), without delaying delivery of each chunk to the caller.
- REQ-2: Track the most complete `usageMetadata` seen across chunks (the last chunk with
  non-empty `promptTokenCount`/`candidatesTokenCount`, per the confirmed detail above) — don't
  assume a fixed chunk index carries it.
- REQ-3: Once the stream is exhausted, in a `finally` block (so this runs even if the caller
  breaks out of the loop early or the generator throws), perform the same core persistence
  `execute()` does:
  - Compute `latencyMs` (from a `startTime` captured before the stream begins).
  - Compute cost via the same `getCostCalculator()` path `execute()` uses.
  - Insert one `usage_data` row (same columns as `execute()`'s, `type: 'execution'`), with
    `full_prompt`/`response_content` from the accumulated prompt/response.
  - Insert `prompt_variables` rows for the same `trackingData.variables` `execute()` tracks.
- REQ-4: **Explicitly deferred to a follow-up, not this track's MVP** (avoids scope creep into a
  much larger surface than "make streaming calls show up in usage_data at all"):
  - Cache check/write for streaming calls (checking cache before starting a stream, or writing
    the accumulated response to cache after) — a real, related gap, but a separate product
    decision (does a cache hit replay as one fake "chunk," or bypass streaming from the cached
    path?) that shouln't block the core reporting fix.
  - `variable_actions`/`security_alerts`/`explain_plans` persistence for streaming — port these
    too if straightforward once REQ-1-3 are solid, but the `usage_data` row alone (with
    `full_prompt` queryable) is what actually unblocks the debugging use case that motivated this
    track (seeing what was sent and how long it took, per streaming call).
- REQ-5: No change to `streamExecute()`'s public generator contract — callers (coachai's
  `ai-chat.mjs`, anything else consuming `for await` chunks) see zero behavior change in what's
  yielded, only a new side effect (DB rows appear) once the stream completes.
- REQ-6: If the underlying LLM call throws mid-stream, the `finally` block should still attempt
  to log what was captured so far (partial `response_content`, whatever `usageMetadata` was seen)
  rather than silently losing the attempt — mirrors `execute()`'s implicit behavior (a thrown
  error there means nothing gets persisted either, but streaming's much longer duration makes a
  failed/aborted stream more likely to be operationally interesting to have a trace of). Treat
  this as a "nice to have, verify feasibility during implementation" item, not a hard blocker.

## Non-Goals

- Multi-language SDK parity (Track 006's PHP/Python SDKs) — this track is the Node/JS engine only.
- Any change to Track 010's Vertex-SDK migration — orthogonal; this sits one layer above
  `llm_clients.js`, in the engine's `streamExecute()` wrapper.
- Retroactively backfilling `usage_data` for historical streaming calls that were never logged —
  not possible (the data was never captured), not attempted.

## Acceptance Criteria

- [ ] A real streamed call (via `TokenTalos.streamExecute()`, the top-level class, not just the
      engine) produces exactly one new `usage_data` row after the stream completes, with
      `full_prompt`/`response_content`/`input_tokens`/`output_tokens`/`latency_ms` all populated
      and non-zero/non-empty.
- [ ] `prompt_variables` rows exist for that same `usage_data.id`, matching what `execute()` would
      produce for an equivalent non-streamed call with the same `parts`.
- [ ] Chunk delivery timing is unaffected — verify the caller still receives chunks incrementally
      as they arrive, not buffered until the stream ends waiting for the reporting step.
- [ ] From coachai (once this ships and coachai's dependency is updated): a real chat message sent
      through `/api/ai/chat/stream` produces a queryable `tokentalos.usage_data` row for
      `endpoint = 'chat_stream'` — the original motivating gap, closed.
