# Track: TokenTalos - Security, Ingress & Budget Governance

## Overview
This track introduces advanced security scanning, a universal OpenAI-compatible API interface, and financial guardrails to TokenTalos. These features transform TokenTalos from a logging utility into a protective gateway capable of defending against prompt injection, simplifying integration, and enforcing budget limits.

## Functional Requirements

### 1. Injection & Secret Scanning (OWASP Focused)
*   **Engine Integration:** Implement an `InjectionScanner` in the processing chain.
*   **Detection Patterns:** Implement 15+ regex patterns to detect common jailbreaks, "DAN" prompts, and prompt injection techniques.
*   **Secret Detection:** Add scanning for high-entropy strings (API Keys, AWS Secrets, Private Keys) within prompt parts.
*   **Configurable Action:** Add `securityAction` to configuration (Options: `reject`, `warn`, `mask`).
*   **Storage:** Log detected security hits in a new `security_alerts` table.

### 2. OpenAI-Compatible Ingress
*   **Mock Endpoint:** Implement `POST /v1/chat/completions`.
*   **Schema Transformation:** Automatically map OpenAI's request schema (messages, model, temperature) to TokenTalos's internal execution engine.
*   **Transparent Routing:** Map incoming OpenAI model requests to the default configured provider (e.g., Gemini) unless specific mapping rules are defined.
*   **Response Mocking:** Return a standard OpenAI-formatted response JSON so that existing client libraries (OpenAI-SDK, LangChain) work without modification.

### 3. Budget Guard / Hard Caps
*   **Monthly Cap:** Support a `monthlyBudget` parameter in the project/org configuration.
*   **Spend Calculation:** Before execution, the engine must query the database for the total `total_cost` of the current project since the 1st of the current month.
*   **Enforcement:** 
    - **Reject (Default):** Fail the request with `402 Payment Required` if the cap is exceeded.
    - **Warn:** Allow the call but flag the usage record as `budget_exceeded`.
*   **Dashboard:** Add a "Budget Progress" bar to the project summary view.

### 4. Model Cost Efficiency (MCE)
*   **Recommendations:** Implement logic to suggest cheaper alternative models based on specific usage patterns (e.g., suggesting Flash for high-volume context tasks).
*   **Visualizations:** Show potential savings from migration in the dashboard.

## Non-Functional Requirements
- **Performance:** Security scanning must add <50ms of latency.
- **Accuracy:** Minimize false positives in injection detection by using specific, known-bad patterns.
- **Reliability:** Budget calculations must be atomic to prevent race conditions during high-volume bursts.

## Acceptance Criteria
- OpenAI SDK can successfully talk to TokenTalos by only changing the `baseURL`.
- Prompts containing "ignore previous instructions" are correctly identified and handled according to the `securityAction` policy.
- Requests are blocked with an informative error message when the monthly project budget is hit.
