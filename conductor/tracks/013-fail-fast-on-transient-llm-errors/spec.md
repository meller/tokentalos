# Spec: Track 013 — Fail fast on transient LLM errors + caller-driven cancellation

## Problem Statement

Root-caused via coachai's Track 135 investigation (cross-referencing tokentalos's own
`usage_data` row against coachai's pino logs): a real chat_stream call hung for **600,309ms
(10 minutes)** before finally throwing `ApiError: got status: UNAVAILABLE. {"error":{"code":503,
"message":"The service is currently unavailable."}}` — a transient Vertex-side outage.

Confirmed via `@google/genai`'s own source (`node_modules/@google/genai/dist/node/index.mjs`):
- `DEFAULT_RETRY_ATTEMPTS = 5` (including the initial call).
- `defaultBackoff = { initialInterval: 500, maxInterval: 60000, exponent: 1.5, maxElapsedTime:
  3600000 }` — a full **hour** ceiling on total retry time.
- `httpOptions.timeout` (per-attempt cap) is a real, documented config field
  (`HttpOptions.timeout`) but `lib/engine/llm_clients.js`'s `getVertex()` never sets it —
  meaning any single attempt can hang as long as the network/Google's backend allows, with
  nothing forcing a fast fail.
- `GenerateContentConfig` also exposes a documented `abortSignal?: AbortSignal` field (client-
  side cancellation — Google's own docs note it "will not cancel the request in the service...
  you will still be charged usage," but it DOES stop the local client from continuing to wait/
  consume, which is exactly what's needed here) — currently never threaded through anywhere in
  this codebase.

Separately (coachai-side, tracked there): the reason this 10-minute hang was invisible to the
user for anywhere near that long is that coachai's route has no abort-handling — when the
client gave up/retried, the original request kept running orphaned server-side. That's out of
scope for this track (belongs in coachai) but this track's `abortSignal` support is the
prerequisite that makes coachai's fix possible.

## Requirements

- REQ-1: `getVertex()` sets `httpOptions: { timeout, retryOptions: { attempts } }` on the
  `GoogleGenAI` client at construction time (applies to every call made through that cached
  client, since one client is reused per `project:location`).
  - `timeout` default: `config.llmRequestTimeoutMs || 30000` (30s) — generous relative to real
    observed Vertex call durations this session (2.9-25s including "thinking" time), while
    capping a stuck attempt far below today's unbounded behavior.
  - `retryOptions.attempts` default: `config.llmMaxRetryAttempts ?? 2` (2 total attempts = 1
    retry, per `HttpRetryOptions`'s own definition: "If 0 or 1, it means no retries").
- REQ-2: Same defaults/config keys applied to `getGemini()`'s direct-API client (Track 010 Phase
  4 already unified both paths on `@google/genai` — keep them consistent).
- REQ-3: Thread an optional `abortSignal` through `execute()`/`streamExecute()` at every layer —
  `TokenTalosEngine` → `LLMGateway` → `executeVertex()`/`streamExecuteVertex()`/
  `executeGemini()`/`streamExecuteGemini()` — passed into `GenerateContentConfig.abortSignal` for
  the actual call. Follows the exact same `options.gcpProjectId`-threading pattern already
  established (`params.abortSignal || options.abortSignal`), so no new plumbing convention.
- REQ-4: No behavior change for callers that don't pass `abortSignal` — purely additive/optional,
  matching REQ-9's spirit from Track 012.
- REQ-5: No change to any function signature that breaks existing callers.
- REQ-6: Verify defaults don't regress normal calls — a real Vertex call under the new 30s
  timeout must still succeed exactly as before (this session has seen legitimate calls take up
  to ~25s due to "thinking" token behavior — must not clip those).

## Non-Goals

- Configuring the backoff curve itself (`initialInterval`/`maxInterval`/`exponent`) — not
  exposed by `@google/genai`'s public `HttpRetryOptions` (only `attempts` is tunable); accepted
  as a real trade-off.
- Actually cancelling the request on Google's backend — `abortSignal` is documented as
  client-side-only; this stops the LOCAL wait/consumption, not server-side billing/processing.
  Still valuable (ends the user-facing hang), just not a full cancellation.
- The coachai-side abort-wiring itself (creating an `AbortController`, listening for
  `req.on('close')`) — that's a separate coachai track; this track only adds the *capability* to
  accept and honor an `abortSignal`.
- Anthropic/OpenAI/DeepSeek client paths — unrelated, not exhibiting this issue, not in scope.

## Acceptance Criteria

- [ ] A real Vertex call still succeeds normally under the new 30s timeout/2-attempt defaults
      (no regression to legitimate slow-but-working calls).
- [ ] A call constructed with an already-aborted `AbortSignal` (`AbortSignal.abort()`) throws
      immediately rather than making the network call at all — proves the signal is actually
      wired through, without needing to wait for a real 10-minute reproduction.
- [ ] A call with a short-fused `AbortSignal` (aborted a few seconds into a real streaming call)
      stops consuming promptly — the caller's `for await` loop exits soon after the abort, not
      after the full natural completion time.
- [ ] `httpOptions`/`abortSignal` confirmed present in the actual request via code
      inspection/real call — not just assumed from the type definitions.
- [ ] Existing tests (`test-vertex-genai.js`, `test-stream-reporting.js`) still pass unchanged.
