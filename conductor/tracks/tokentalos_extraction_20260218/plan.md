# Implementation Plan: TokenTalos Extraction and Unification

## Phase 1: Project Scaffolding & Setup Phase (Refined)
Initialize the new stack and implement the expanded interactive CLI setup.

- [x] Task: Initialize Project Structure
- [x] Task: Implement Interactive CLI Setup (Port 5060/5062, Gemini 3 Default)
- [ ] Task: Expand Setup with New Optional Features
    - [ ] Add PII Redaction toggle (Mask/Warn/Reject)
    - [ ] Add Semantic Caching toggle
    - [ ] Add Export Target configuration
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Project Scaffolding' (Protocol in workflow.md)

## Phase 2: Core API & Database Implementation
Implement the SQLite/Postgres storage and the orchestration/ingestion endpoints.

- [x] Task: Database Schema & Models (SQLite/Postgres Support)
- [x] Task: Ingestion & Construction API Endpoints
- [ ] Task: Implement PII Redaction Middleware
    - [ ] Write regex/heuristic patterns for Email, API Keys, etc.
    - [ ] Implement Mask/Warn/Reject logic in the processor
- [ ] Task: Implement Semantic Caching Layer
    - [ ] Implement local cache storage (in DB or memory)
    - [ ] Implement hash-based lookup for identical constructions
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core API' (Protocol in workflow.md)

## Phase 3: Gateway & Execution Logic
Transform TokenTalos into an active LLM Proxy.

- [ ] Task: Implement LLM Execution Clients
    - [ ] Add support for Gemini, Anthropic, and OpenAI SDKs in the backend
    - [ ] Implement provider-agnostic `execute` interface
- [ ] Task: Gateway API Endpoint (`/api/prompt/execute`)
    - [ ] Implement the full lifecycle: Construct -> Process -> Cache -> Execute -> Log
- [ ] Task: Streaming OPV Implementation
    - [ ] Implement chunk-based processing for thinking tokens
    - [ ] Implement the `STOP` signal logic for reasoning models
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Gateway' (Protocol in workflow.md)

## Phase 4: CLI, Dashboard & Intelligence
Port visualizations and implement advanced analysis.

- [x] Task: Implement CLI Data Commands (stats, list, heatmap)
- [x] Task: Port Dashboard Visualizations (Port 5060)
- [ ] Task: Implement Model Cascading Recommendations
    - [ ] Port logic to suggest splitting/summarizing prompts via LLM Architect
- [ ] Task: Export Feature
    - [ ] Implement `tokentalos export --format langsmith|jsonl`
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Dashboard & Export' (Protocol in workflow.md)

## Phase 5: SDK Development & Final Packaging
Create client libraries for easy integration.

- [ ] Task: Node.js SDK
    - [ ] Implement `TokenTalosClient` with `construct` and `execute` methods
- [ ] Task: PHP SDK
    - [ ] Implement Composer package for TokenTalos integration
- [ ] Task: Final Build & npx Verification
- [ ] Task: Conductor - User Manual Verification 'Phase 5: SDKs' (Protocol in workflow.md)
