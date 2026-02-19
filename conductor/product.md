# Token Talos Product Definition

## Mission
To provide the **"ORM for LLMs"** — a library-first LLM Gateway and Proxy that empowers developers to build modular, tracked, and cost-optimized prompts with built-in safety filtering and reasoning verification. 

Token Talos treats prompts like structured queries, binding variables securely while applying active compression and heuristic optimizations.

## Operational Modes
- **Standalone (Library):** Direct npm import for Node.js projects with internal logic and direct DB access.
- **Proxy (Gateway):** Standalone Express server for cross-platform integration (PHP, Python, etc.).

## Target Users
- **AI Developers:** Seeking local-first tools for prompt engineering, variable binding, and cost optimization.
- **Teams:** Wanting a shared, lightweight proxy to track LLM usage, enforce safety guardrails, and reduce costs across projects.
- **Open Source Community:** Looking for a portable, "zero-install" alternative to large, centralized observability platforms.

## Key Features
- **Prompt Orchestration (ORM):** Build modular, parameterized prompts from controlled parts with secure variable binding.
- **LLM Gateway:** Active execution proxy supporting OpenAI, Anthropic, Google, DeepSeek, and more.
- **Semantic Caching:** Skip redundant LLM calls for identical prompt constructions.
- **PII Redaction & Security:** Automatic scanning for Prompt Injection (LLM01), Secret Disclosure (LLM06), and masking of sensitive data.
- **Streaming OPV:** Real-time "Optimized Process Verification" of thinking tokens to detect and terminate failing reasoning paths.
- **Active Optimization:** Lossless compression (whitespace/JSON minification) and heuristic-based model recommendations.
- **Cost Analysis:** Granular token attribution by variable and real-time provider cost comparisons.
- **Zero-Install:** SQLite default with a built-in CLI and Dashboard suite.

