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

### 🌍 Cross-Language Support
TokenTalos is designed as a language-agnostic Gateway. You can use standard HTTP clients in any language (PHP, Python, Go, etc.) to communicate with the TokenTalos Proxy.

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
