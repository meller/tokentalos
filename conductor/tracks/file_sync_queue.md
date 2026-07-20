# File Sync Queue

## Track Creation Requests

### Track 014: Configurable Gemini thinking level (default MINIMAL)
**Status**: processed
**Type**: track-create
**Created**: 2026-07-20T00:00:00.000Z
**Title**: Configurable Gemini thinking level (default MINIMAL)
**Description**: Real measurement from coachai: gemini-3.5-flash defaults to thinking_level medium, consuming hundreds-thousands of tokens per call. On a real representative prompt (app's actual call shape, no max_tokens cap): default averaged ~27s across trials; thinkingLevel MINIMAL averaged ~12s (45-70% faster every trial), with no observed quality loss (comparable output length, correct term+mechanism usage, 100% marker compliance across all trials). thinkingBudget (token-count control) was tried first and found unreliable for this model. Adds config.llmThinkingLevel (engine-level) + options.thinkingLevel (per-call override), defaulting to 'MINIMAL' package-wide when unset — a deliberate behavior change from today's silent medium default, with explicit null as the opt-out.
**Metadata**: { "priority": "high", "assignee": null }

### Track 013: Fail fast on transient LLM errors + support caller-driven cancellation
**Status**: processed
**Type**: track-create
**Created**: 2026-07-20T00:00:00.000Z
**Title**: Fail fast on transient LLM errors + support caller-driven cancellation
**Description**: Root-caused (coachai Track 135) a real 10-minute hang from a transient Vertex 503 — @google/genai defaults to 5 retry attempts with a 1-hour maxElapsedTime backoff ceiling, and no httpOptions.timeout is set anywhere in getVertex(), so a stuck attempt can hang indefinitely. Fix: set a bounded httpOptions.timeout + retryOptions.attempts on the cached Vertex/Gemini clients (configurable, sensible defaults), and thread an optional per-call abortSignal (a real documented GenerateContentConfig field) through execute()/streamExecute() at every layer so a caller can cancel an in-flight call on its own client disconnect.
**Metadata**: { "priority": "high", "assignee": null }

### Track 012: Structured (pino) logging for the engine layer
**Status**: processed
**Type**: track-create
**Created**: 2026-07-19T00:00:00.000Z
**Title**: Structured (pino) logging for the engine layer
**Description**: Discovered while investigating Track 011's persist-failure catch block — a real ~76s call completed successfully but left no usage_data row, and the console.warn meant to surface that had nowhere durable to go (consumers piping stdout into pinorama-style viewers silently drop plain-text lines). tokentalos has zero pino dependency; all 17 diagnostic call sites in lib/engine/*.js and index.js are plain console.log/warn/error. Fix: add pino, a small shared logger (lib/logger.js), let TokenTalosEngine/LLMGateway/TokenTalos accept an optional config.logger override, convert all 17 call sites. bin/tokentalos.js (CLI UX) and api/*.js (separate dashboard server) explicitly out of scope.
**Metadata**: { "priority": "medium", "assignee": null }

### Track 011: streamExecute() doesn't report usage (no DB trail for streaming calls)
**Status**: processed
**Type**: track-create
**Created**: 2026-07-19T00:00:00Z
**Title**: streamExecute() doesn't report usage (no DB trail for streaming calls)
**Description**: Moved from coachai's Track 067 (scoped there while debugging ai-chat.mjs's streaming path, never implemented — the actual fix is entirely inside this package). streamExecute() (lib/engine/index.js) is a plain generator pass-through unlike execute(), which inserts usage_data/prompt_variables/variable_actions/security_alerts/explain_plans rows after the LLM call resolves. No accumulation, no persistence, no cache check for streaming — every consumer that streams (the primary chat interaction mode) gets zero queryable history. Live-verified during Track 010's work: streamed chunks only carry full usageMetadata on the last chunk. Fix: accumulate content + track usage across chunks, persist the core usage_data/prompt_variables rows in a finally block once the stream completes, without adding latency to chunk delivery. MVP scope explicitly excludes cache support and variable_actions/security_alerts/explain_plans for streaming (deferred).
**Metadata**: { "priority": "medium", "assignee": null }

### Track 010: Migrate off deprecated @google-cloud/vertexai SDK
**Status**: processed
**Type**: track-create
**Created**: 2026-07-19T00:00:00Z
**Title**: Migrate off deprecated @google-cloud/vertexai SDK
**Description**: Discovered from a consumer app (coachai) reporting severe chat-response slowness, traced by direct reproduction (bypassing the consumer app entirely) to this package's Vertex AI client path. lib/engine/llm_clients.js constructs `new VertexAI(pgConfig)` from @google-cloud/vertexai — a class Google's own SDK warning says was deprecated 2026-06-24 and removed 2026-06-24 2026 (we are ~1 month past that date). Replaying identical prompt content that took ~1.2s on 2026-07-13 now takes 5-9+ seconds through this exact code, unchanged. Fix: migrate getVertex/executeVertex/streamExecuteVertex to the new @google/genai SDK (confirmed via Google's migration guide to support the same Vertex project/location config), and do the same for the direct-Gemini-API path (getGemini/executeGemini) for consistency. No public API surface change for consumers.
**Metadata**: { "priority": "high", "assignee": null }


## Completed Queue

### Track 008: Fix PII Config Scope Bug
**Status**: processed
**Type**: track-create
**Created**: 2026-03-23T00:00:00Z
**Title**: Fix PII Config Scope Bug
**Description**: Bug in TokenTalos v1.0.7 — when PII security findings are detected, it tries to log them using config.securityAction but config is out of scope (should be this.config). This crashes when any user message triggers PII detection. Fix: change config.securityAction to this.config.securityAction in the PII detection handler.
**Processed**: 2026-07-19T08:09:12.208Z
