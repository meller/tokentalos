# Implementation Plan: TokenTalos Phase 2

## Phase 1: Engine Decoupling (Library-First Refactor)
Decouple logic from Express and enable direct package imports.

- [x] Task: Create Host-Agnostic Engine
    - [x] Move logic from `api/services` and `api/core` to a new `lib/engine` structure.
    - [x] Remove all HTTP/Express dependencies from the Engine.
    - [x] Implement `TokenTalosEngine` class that handles config, DB, and execution.
- [x] Task: Package Entry Point
    - [x] Update `package.json` to export the Engine for direct imports.
    - [x] Implement `TokenTalos.init(config)` for standalone usage.
- [x] Task: Update Server to use Engine
    - [x] Refactor Express routes to be thin wrappers around the `TokenTalosEngine`.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Engine Refactor' (Protocol in workflow.md)

## Phase 2: Gateway & Safety Enhancements
Refine features within the new Engine architecture.

- [x] Task: PII Detection Logic (Moved to Engine)
- [x] Task: LLM Provider Clients (Moved to Engine)
- [x] Task: Implement PII Mask/Warn/Reject in Engine logic.
- [x] Task: Finalize Gateway API (`execute`) using the Engine.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Gateway' (Protocol in workflow.md)

## Phase 3: Intelligence & Caching
Implement caching and reasoning checks in the Engine.

- [x] Task: Engine Caching Layer
    - [x] Implement exact-match prompt hashing and DB lookup in the Engine.
- [x] Task: Streaming OPV Implementation
    - [x] Implement heartbeat analysis logic in the Engine.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Intelligence' (Protocol in workflow.md)

## Phase 4: CLI & Integration
Update CLI for new architectural modes.

- [x] Task: Implement CLI Data Commands
- [x] Task: Port Dashboard Visualizations
- [x] Task: Add `tokentalos dashboard` command (Reader mode).
- [x] Task: Export Feature (JSONL/LangSmith).
- [x] Task: Node.js SDK Development.
- [x] Task: PHP SDK Development (PostgreSQL & Vertex AI Integration verified).
- [x] Task: Conductor - User Manual Verification 'Phase 4: Integration' (Protocol in workflow.md)
