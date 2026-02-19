# Implementation Plan: TokenTalos - Multi-Project Analytics & Multi-Tenancy

## Phase 1: Multi-Tenant Schema & Core
Add support for Organizations, Users, and API Keys to the database.

- [x] Task: Database Schema Update
    - [x] Add `organizations`, `api_keys`, `users`, and `organization_members` tables.
    - [x] Add `org_id` column to `usage_data`.
- [x] Task: Update TokenTalosEngine
    - [x] Update engine to handle `org_id` and `managedMode`.
    - [x] Implement `validateApiKey` helper.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Multi-Tenant Schema' (Protocol in workflow.md)

## Phase 2: Authorization & API
Secure the ingestion and execution endpoints.

- [x] Task: Auth Middleware
    - [x] Implement `X-TokenTalos-Key` header validation.
    - [x] Inject `org_id` into the request context.
    - [x] Support "Local Mode" where keys are optional and default to `default_org`.
- [x] Task: Update API Endpoints
    - [x] Ensure all ingestion and execution calls are gated by the Auth Middleware.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Auth API' (Protocol in workflow.md)

## Phase 3: Dashboard Multi-Tenancy
Update UI to reflect organization-level isolation.

- [x] Task: Project Filter Update
    - [x] Update `/analytics/projects` to return unique IDs.
- [x] Task: Project Segregation Logic
    - [x] Update stats and heatmap APIs to strictly filter by `org_id` derived from Auth.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Dashboard Isolation' (Protocol in workflow.md)

## Phase 4: SDK Integration
Enable secure client communication.

- [x] Task: Update Node.js SDK
    - [x] Add `projectId` support.
- [x] Task: Secure SDK mode
    - [x] Add `apiKey` support to `TokenTalos` constructor and headers.
- [x] Task: Conductor - User Manual Verification 'Phase 4: SDK Security' (Protocol in workflow.md)
