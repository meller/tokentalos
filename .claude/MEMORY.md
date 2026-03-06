# TokenTalos — Claude Memory

## Project Identity
- **Name**: TokenTalos (`@meller/tokentalos`)
- **Mission**: "The ORM for LLMs" — library-first LLM Gateway with prompt orchestration, security, caching, and cost analysis
- **npm**: `@meller/tokentalos` (public, MIT)

## Key Paths
- Engine logic: `lib/engine/` (framework-agnostic)
- API routes: `api/api/` (Express)
- CLI: `bin/tokentalos.js` (commander)
- Dashboard: `dashboard/` (Vite + React + TypeScript + Tailwind v4)
- LLM clients: `lib/engine/llm_clients.js`
- Cache: `lib/engine/cache.js`

## Stack
- Node.js ESM (`"type": "module"`)
- Express v5, SQLite (default) / PostgreSQL (opt-in)
- LLM providers: OpenAI, Anthropic, Google Generative AI, Vertex AI, DeepSeek
- No eslint/prettier config files — follow `conductor/code_styleguides/javascript.md`

## LaneConductor Tracks
- Track 001-005: backlog (imported from previous conductor tool)
- Track 006: done (SDK development — PHP/Python SDKs complete)
- Next track number: 007

## Workflow
- Conventional commits with track numbers: `feat(track-001): description`
- Feature branches: `track-NNN-description`
- `public` branch: sanitized public-facing branch
