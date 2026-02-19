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
- [ ] Task: Model Migration Recommendations (MCE)
    - [ ] Implement real-time "Alternative Model" cost comparison logic.
    - [ ] Add a prominent "Migration Insight" card to the dashboard summary.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration & UI' (Protocol in workflow.md)
