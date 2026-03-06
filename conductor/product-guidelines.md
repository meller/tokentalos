# TokenTalos Product Guidelines

## Design Principles

1. **Library-First**: TokenTalos is primarily an npm library. Every feature must work in standalone mode before it works in proxy/gateway mode.
2. **Zero-Install Default**: SQLite is the default database. PostgreSQL is opt-in. Users should be able to `npm install` and start immediately.
3. **Local-First**: No telemetry, no cloud dependencies, no required accounts. All data stays on the user's machine.
4. **Security by Default**: PII redaction, injection scanning, and secret detection are on by default. Users must explicitly opt out.
5. **ORM Mental Model**: Prompts are structured queries with bound variables — not raw strings. The API should reinforce this mental model.

## API Design Standards

- Public methods follow the ORM pattern: `execute()`, `build()`, `analyze()` — not `sendMessage()` or `callLLM()`.
- Configuration is passed at construction, not per-call (unless overriding).
- All async methods return structured result objects, never raw provider responses.
- Errors are typed and descriptive — never swallowed silently.

## Feature Scope Boundaries

**In scope:**
- Prompt construction, variable binding, compression
- LLM execution (OpenAI, Anthropic, Google/Vertex, DeepSeek)
- Security scanning (injection, secrets, PII)
- Semantic caching
- Cost analysis and token attribution
- Streaming OPV (thinking token verification)
- CLI and dashboard for observability

**Out of scope:**
- Managing conversation history (use the LLM provider's API)
- Fine-tuning or training models
- Replacing a full observability platform (DataDog, LangSmith)
- Multi-user auth or multi-tenant SaaS features

## UX Standards

- CLI commands must support non-TTY environments (`--json` flag for machine-readable output).
- Dashboard is a local dev tool — not a production monitoring UI.
- Error messages must include actionable remediation steps.
- All user-facing strings use plain English — no jargon.

## Versioning & Release

- Follows SemVer. Breaking changes require a major version bump.
- Published to npm as `@meller/tokentalos`.
- Changelog maintained for every release.
