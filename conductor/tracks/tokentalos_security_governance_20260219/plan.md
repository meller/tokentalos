# Implementation Plan: TokenTalos - Security, Ingress & Budget Governance

## Phase 1: Security Scanning (Injection & Secrets)
Add protective scanning to the engine processing chain.

- [ ] Task: Database Schema Update
    - [ ] Create `security_alerts` table (id, usage_id, type, description, severity, action_taken).
- [ ] Task: Implement InjectionScanner
    - [ ] Write tests for common jailbreak patterns (DAN, "ignore previous instructions").
    - [ ] Implement regex-based detection logic in `lib/engine/security.js`.
- [ ] Task: Implement SecretScanner
    - [ ] Write tests for detecting API keys and AWS secrets.
    - [ ] Implement high-entropy string detection logic.
- [ ] Task: Integrate with Engine
    - [ ] Add security scanning to `TokenTalosEngine.process()`.
    - [ ] Support `securityAction` config (reject, warn, mask).
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Security Scanning' (Protocol in workflow.md)

## Phase 2: OpenAI-Compatible Ingress
Support drop-in replacement for OpenAI SDKs.

- [ ] Task: Implement Ingress Endpoint
    - [ ] Create `POST /v1/chat/completions` route in Express.
- [ ] Task: Implement Schema Mapper
    - [ ] Create utility to convert OpenAI message format to TokenTalos prompt parts.
    - [ ] Create utility to convert TokenTalos execution results to OpenAI completion format.
- [ ] Task: Verification
    - [ ] Write integration test using the official OpenAI Node.js library pointing to TokenTalos.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: OpenAI Ingress' (Protocol in workflow.md)

## Phase 3: Budget Governance (Hard Caps)
Prevent overspend through automated financial guardrails.

- [ ] Task: Database Spend Analytics
    - [ ] Implement `getMonthlySpend(projectId)` in `lib/engine/db.js`.
- [ ] Task: Implement Budget Enforcement
    - [ ] Add budget check logic to `TokenTalosEngine.execute()` before LLM call.
    - [ ] Implement `402 Payment Required` rejection response.
- [ ] Task: Verification
    - [ ] Write test case for budget exhaustion and subsequent rejection.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Budget Governance' (Protocol in workflow.md)

## Phase 4: Integration & UI
Expose new security and financial data in the Dashboard.

- [ ] Task: Budget Progress UI
    - [ ] Add a progress bar to the project summary showing current spend vs. monthlyBudget.
- [ ] Task: Security Alerts Log
    - [ ] Create a section in prompt details to show intercepted security threats.
- [x] Task: Prompt Expansion Tabs UI
    - [x] Refactor the expanded prompt view in the dashboard to use tabs instead of a long vertical list.
    - [x] Create tabs for: "Variables", "Engine Insight", "Model Comparison", and "Reasoning Verification" (OPV).
- [x] Task: Model Migration Recommendations (MCE)
    - [x] Implement real-time "Alternative Model" cost comparison logic for specific prompts.
    - [x] Add model comparison details to the "Model Comparison" tab showing cost differences across engines and the best recommendation.
    - [x] Add `mce_alternatives` column to `explain_plans` DB schema (SQLite + PostgreSQL).
    - [x] Persist `mce_alternatives` JSON in both the engine execute path and the API execute endpoint.
    - [x] Add provider alias mapping (`gemini` → `google`, `aws` → `amazon`, etc.) to `pricing.js` so callers using informal provider names get correct cost calculations.
    - [x] Fix on-the-fly MCE backfill in `/recent` endpoint to use `calculateCost()` from tokens (not stored `total_cost` which is `0` for passively-ingested records) — this unblocks `mce_best_alternative_model` being set and "Save X%" badges appearing.
    - [x] Fix cost display in prompt card header and Model Comparison "Current" row to derive cost from `mce_alternatives[0].savingsPct` when `total_cost = 0`.
    - [x] Remove duplicate "Save X%" badge (was appearing in both the title row and subtitle row).
    - [x] Add Jest unit tests for `CostCalculator`: `calculateCost`, `getBestAlternative`, `getAllAlternatives`, and provider alias resolution.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration & UI' (Protocol in workflow.md)
