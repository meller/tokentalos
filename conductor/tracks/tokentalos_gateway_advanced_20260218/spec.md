# Track: TokenTalos Phase 2 - Gateway & Advanced Optimization

## Overview
This track evolves TokenTalos into a **Library-First LLM Gateway**. It decouples the core logic into an "Engine" that can be imported directly into Node.js applications (Mode A) or run as a standalone Proxy server (Mode B).

## Functional Requirements

### 1. Dual-Mode Architecture
*   **Mode A (Library):** Importable npm package. Runs logic (Safety, Caching, Execution) in-process and writes directly to the local DB.
*   **Mode B (Proxy):** Standalone Express server. Acts as a gateway for non-Node projects (PHP, Python) or distributed teams.

### 2. Core Engine (Host-Agnostic)
*   Decouple PII detection, string compression, and token attribution from the Express request lifecycle.
*   Unified `execute()` and `construct()` methods available via the library API.

### 3. LLM Execution Gateway
*   **Active Execution:** Full lifecycle: Orchestrate -> Process -> Cache Check -> LLM Execution -> Tracking -> Result.
*   **Providers:** Support for Gemini, Anthropic, and OpenAI SDKs.

### 4. PII Redaction & Safety
*   **Logic:** Detect and handle sensitive data (Emails, API Keys, etc.).
*   **Actions:** Mask, Warn, or Reject.

### 5. Semantic Caching
*   **Logic:** Skip identical prompt constructions if a recent result exists in the local DB.

### 6. Streaming OPV
*   **Logic:** Analyze thinking tokens in real-time and return a `STOP` signal if reasoning fails.

### 7. CLI & Dashboard
*   **Viewer Mode:** `npx tokentalos dashboard` starts a read-only UI pointing to the local DB.
*   **Export:** Export logs to JSONL or LangSmith.

## Non-Functional Requirements
*   **Zero Dependency (Runtime):** The core engine should not require a running server to function.
*   **Portability:** The same SQLite file must be readable by both the Library and the Dashboard.
