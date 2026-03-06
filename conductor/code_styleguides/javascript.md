# JavaScript / Node.js Style Guide

## Module System

- **ESM only** (`"type": "module"` in package.json). Use `import`/`export` — never `require()`.
- Named exports preferred over default exports for library code. Default export allowed for the main class (`TokenTalos`).

## Async

- Use `async/await` throughout. Avoid raw Promise chains.
- Always `await` before returning from an async function — no fire-and-forget unless explicitly documented.

## Error Handling

- Use typed error classes (e.g., `class TokenTalosError extends Error`).
- Never swallow errors silently. Always `throw` or `return` a structured error object.
- Wrap external LLM provider calls in try/catch with provider-specific error normalization.

## Naming Conventions

- `camelCase` for variables, functions, and methods.
- `PascalCase` for classes.
- `SCREAMING_SNAKE_CASE` for true constants (e.g., `MAX_RETRIES = 3`).
- Files: `kebab-case.js` for modules, `PascalCase.js` for class definitions.

## Code Structure

- Engine logic lives in `lib/engine/` — framework-agnostic, no Express imports.
- API routes live in `api/api/` — thin controllers that call engine methods.
- CLI commands live in `bin/` — use `commander` for argument parsing.
- Dashboard code lives in `dashboard/` — Vite + React (TypeScript).

## Formatting

- 2-space indentation.
- Single quotes for strings.
- No semicolons (unless needed for disambiguation).
- Max line length: 100 characters.
- Trailing commas in multi-line arrays/objects.

## Comments

- JSDoc for all public API methods (`@param`, `@returns`, `@throws`).
- Inline comments for non-obvious logic only — code should be self-documenting.
- TODO/FIXME comments must include a track number: `// TODO(track-007): description`.

## Testing

- Test files live alongside source: `lib/engine/cache.test.js`.
- Jest/Vitest compatible (ESM test runner).
- Unit tests for all engine logic. Integration tests for API routes.
- No mocking of the engine in integration tests — use SQLite in-memory DB.
