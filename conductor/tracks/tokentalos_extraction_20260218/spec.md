# Track: TokenTalos Extraction and Unification

## Overview
Extraction and unification of `TokenTalos` from `macrodash` into a standalone Node.js utility. This service acts as an **LLM Gateway & Proxy**, allowing projects to build modular, tracked, and cost-optimized prompts while providing active execution, safety filtering, and reasoning verification.

## Functional Requirements

### 1. Unified Node.js Service & CLI
*   **CLI Entry:** `npx tokentalos` starts the service.
*   **Initial Setup Phase (CLI Interactive):**
    1.  **Data Storage:** Configure SQLite/PostgreSQL.
    2.  **LLM Configuration:** 
        - Default Provider: Gemini (ADC). Alternatives: Anthropic, OpenAI.
    3.  **Formatting & Safety (Optional):**
        - *Compress:* Lossless string compression.
        - *Neutralize:* XML-wrapping of user data.
        - *PII Redaction:* Masking of sensitive info (Email, Keys). Action: [Mask, Warn, Reject].
    4.  **Intelligence & Optimization (Optional):**
        - *Semantic Caching:* Cache identical prompt constructions to skip LLM calls.
        - *OPV:* AI-driven reasoning verification and "kill signal" for streaming.
        - *Model Cascading:* Suggest splitting or summarizing large prompts using cheaper models.
    5.  **Export & Integration:** Enable exports to LangSmith or JSONL format.

### 2. API Port (Gateway, Orchestration & Ingestion)
*   **Active Execution (Gateway):** `POST /api/prompt/execute`
    - Full lifecycle: Construct -> Process (Safety/Efficiency) -> Cache Check -> LLM Call -> Log -> Return Result.
*   **Parameterized Orchestration:** `POST /api/prompt/construct`
    - Replicate `TokenTalosPrompt` logic: Combine named parts into provider-specific formats.
*   **Legacy Ingestion:** `POST /api/ingest` for tracking pre-constructed prompts.
*   **Streaming OPV:** Support for receiving "thinking token" chunks and returning a `STOP` or `CONTINUE` signal.

### 3. Dashboard Port (UI)
*   **Visualizations:** Total Tokens, Cost, Heatmaps for variable dominance.
*   **Gateway Monitoring:** Real-time view of LLM responses, cache hit rates, and PII redaction logs.
*   **Optimization Insights:** Recommendations for model cascading and prompt trimming.

### 4. SDKs
*   **Node.js SDK:** Seamless integration for JavaScript/TypeScript projects.
*   **PHP SDK:** Integration for Laravel/Symfony/Vanilla PHP applications.

## Non-Functional Requirements
*   **Safe Assembly:** Manage whitespace and delimiters during part concatenation.
*   **Zero-Install:** SQLite default ensures no infrastructure burden for users.
*   **Low Latency:** The proxy layer should add <50ms overhead (excluding AI analysis).
