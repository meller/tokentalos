# TokenTalos 🛡️

**The "ORM for LLMs"** — A library-first LLM Gateway and Proxy that empowers developers to build modular, tracked, and cost-optimized prompts with built-in safety filtering and reasoning verification.

Think of TokenTalos as an **Object-Relational Mapper (ORM)**, but for your Large Language Model interactions. Instead of sending raw, expensive, and potentially insecure strings to providers, you define **parameterized prompt parts** that TokenTalos binds, compresses, and secures before execution.

## 🚀 Key Features

### 1. Active Guard (Security & Safety)
*   **Prompt Injection Scanning (LLM01):** Heuristic detection of jailbreaks, "Ignore instructions", and system overrides.
*   **Secret Detection (LLM06):** Automatic scanning for API keys, AWS secrets, and high-entropy strings.
*   **PII Redaction:** Automatic masking or rejection of sensitive data (Emails, Keys) before logging or execution.
*   **Input Neutralization:** Automatic XML-wrapping of untrusted data with injected security instructions for the LLM.

### 2. Efficiency & Cost Optimization
*   **Semantic Caching:** Skip redundant LLM calls for identical prompt constructions.
*   **Lossless Compression:** Automatic minification of whitespace and JSON blocks within prompts.
*   **Cost Analysis:** Detailed token attribution and real-time provider cost comparisons.
*   **Optimization Recommendations:** Heuristic-based suggestions for model switching and prompt pruning to reduce token weight.
*   **Tokenizer Discrepancy Detection:** Advanced analysis of local vs. provider token counting.

### 3. Intelligence & Observability
*   **Streaming OPV (Optimized Process Verification):** Real-time analysis of "thinking tokens" to verify if reasoning is on-track or looping.
*   **Variable Attribution:** Granular tracking of token weight per prompt part (e.g., system vs context vs query).
*   **Engine Insights:** Heuristic-based recommendations for semantic summarization and prompt pruning.

## 🚀 Quick Start (SDK)

TokenTalos is primarily a developer tool. You can use it as a standalone library (direct DB access) or as a client to a remote Gateway.

### Standalone Mode (Library-First)
Ideal for local development or Node.js backends where you want Zero-Install tracking.

```javascript
import TokenTalos from 'tokentalos';

const tt = new TokenTalos({
  mode: 'standalone',
  projectId: 'my-project-id',
  config: {
    // Database and Persistence
    databaseType: 'sqlite',
    sqlitePath: './tokentalos.db',

    // Regional and Provider Settings
    location: 'us-central1', // GCP/Vertex Region
    
    // Feature and Policy Configuration
    securityFeatures: ['injection', 'secrets'],
    formattingFeatures: ['pii', 'neutralize'],
    intelligenceFeatures: ['cache', 'explain'],
    piiAction: 'mask' // Automatic PII masking
  }
});

await tt.init();

const result = await tt.execute({
  provider: 'gemini',
  model: 'gemini-3-flash-preview',
  parts: {
    system: 'You are a technical writer.',
    user_query: 'Explain TokenTalos in 20 words.'
  }
});

console.log(result.content);
```

> **Note:** TokenTalos includes native support for Google Gemini. To use other providers (OpenAI, Anthropic, etc.), ensure you have their respective API keys configured and dependencies installed.

### Proxy Mode (Gateway)
Ideal for production environments or non-Node.js apps (PHP, Python, Go) connecting to a central TokenTalos server.

```javascript
const tt = new TokenTalos({
  mode: 'proxy',
  apiUrl: 'https://your-gateway.com/api/v1',
  apiKey: 'your-secret-key'
});
```

### 🐳 Sidecar Mode (Non-Node.js Backends)
Ideal for **Python, Go, PHP, or any non-Node.js backend** running in Docker or a managed cloud container (e.g., Cloud Run, Fly.io, Railway). Instead of deploying a separate TokenTalos service, you bundle it as a co-process that starts alongside your main app.

**How it works:**
- TokenTalos Express API runs on `localhost:8060` inside the same container
- Your backend calls it via standard HTTP — no special SDK needed
- Config is driven entirely by environment variables (no interactive wizard)

**Step 1 — Create a sidecar entry point** (`tokentalos-sidecar.mjs`):

```js
import { startServer } from '/app/tokentalos/api/index.js';
import fs from 'fs';

fs.mkdirSync('/tmp/tokentalos', { recursive: true });

await startServer({
  databaseType: 'sqlite',
  sqlitePath: '/tmp/tokentalos/data.db',
  enableCollector: true,
  enableDashboard: false,
  gatewayPort: parseInt(process.env.TOKENTALOS_PORT || '8060'),

  llmProvider: 'gemini',
  defaultModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

  // ADC (Vertex AI) when running in Cloud Run; API key for local/other environments
  geminiAuthType: process.env.GEMINI_API_KEY ? 'apikey' : 'adc',
  geminiApiKey: process.env.GEMINI_API_KEY,
  gcpProjectId: process.env.GCP_PROJECT || 'my-gcp-project',

  formattingFeatures: ['compress'],
  securityFeatures: [],
  intelligenceFeatures: ['cache'],
  maxTokens: 16000,
});
```

**Step 2 — Add to your Dockerfile:**

```dockerfile
# Install Node.js alongside your runtime (example: Python)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Copy TokenTalos source and install prod deps
COPY tokentalos/ /app/tokentalos/
COPY tokentalos-sidecar.mjs /app/
RUN cd /app/tokentalos && npm ci --omit=dev

# Use an entrypoint script instead of CMD
ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

**Step 3 — Create `docker-entrypoint.sh`:**

```bash
#!/usr/bin/env bash
set -e

# Start TokenTalos sidecar in background
node /app/tokentalos-sidecar.mjs &

# Give it a moment to initialize SQLite + bind port
sleep 2

# Start your main app as PID 1 (receives container signals)
exec uvicorn app.main:app --host 0.0.0.0 --port 8080
```

**Step 4 — Call from your backend (Python example):**

```python
import httpx

response = await httpx.AsyncClient().post(
    "http://localhost:8060/api/v1/usage/execute",
    json={
        "projectId": "my-project",
        "provider": "gemini",
        "model": "gemini-2.0-flash",
        "parts": {
            "system": "You are a helpful assistant.",
            "user_query": "Summarize today's market conditions."
        }
    }
)
result = response.json()
print(result["content"])
```

**Environment variables for the sidecar:**

| Variable | Default | Description |
|---|---|---|
| `TOKENTALOS_PORT` | `8060` | Port the sidecar binds to |
| `GEMINI_API_KEY` | — | Gemini API key (omit to use ADC/Vertex AI) |
| `GCP_PROJECT` | — | GCP project ID (required for ADC) |
| `GCP_LOCATION` | `global` | Vertex AI region |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Default LLM model |

> **Tip for Cloud Run / GCP:** Omit `GEMINI_API_KEY` entirely. TokenTalos will use Application Default Credentials (ADC) via the container's service account — no secrets needed.

### 🌍 Cross-Language Support
TokenTalos is designed as a language-agnostic Gateway. You can use standard HTTP clients in any language (PHP, Python, Go, etc.) to communicate with the TokenTalos Proxy or Sidecar.

Check out the [examples/](./examples) directory for a **PHP cURL** example.

## 🛠️ Installation

```bash
# As a project dependency
npm install tokentalos

# For CLI and Dashboard access
npx tokentalos setup
```

## 🏗️ Architecture

## 💻 CLI Usage

| Command | Description |
| :--- | :--- |
| `tokentalos setup` | Run the interactive configuration wizard. |
| `tokentalos start` | Start the full service (Collector + Dashboard). |
| `tokentalos start collector` | Start only the API ingestion service. |
| `tokentalos start dashboard` | Start only the visual interface. |
| `tokentalos stop` | Stop all services. |
| `tokentalos stats` | Show aggregate token and cost statistics in the terminal. |
| `tokentalos list` | Display a table of recent prompt logs. |
| `tokentalos export` | Export usage logs to JSONL or LangSmith formats. |

## 🧩 Special Variables

TokenTalos recognizes specific variable names to enable enhanced features:
*   `safety_guardrails`: Used as ground-truth context for OPV verification.
*   `thinking` / `reasoning`: Targeted for chain-of-thought analysis.
*   `system` / `context` / `history`: Recognized for specialized tracking and bloating analysis.

---
*For a full list of variable behaviors, see [VARIABLES.md](./VARIABLES.md).*
