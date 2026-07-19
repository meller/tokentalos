# File Sync Queue

## Track Creation Requests

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
