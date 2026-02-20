# Specification: Publish Token Talos to npm

## Overview
Prepare and publish the "Token Talos" project to the public npm registry as `@meller/tokentalos`. This track focuses on distributing the core library, CLI, and Collector API for HTTP-based data ingestion, while excluding the dashboard UI to maintain a lean distribution.

## Functional Requirements
1.  **Registry Configuration:**
    *   Update `package.json` to target the public npm registry (npmjs.com).
    *   Set the package access level to `public`.
2.  **Versioning:**
    *   Set the initial public release version to `1.0.0`.
3.  **Package Bundling:**
    *   Ensure the `files` array in `package.json` includes:
        *   Core Engine: `lib/engine/`
        *   Primary SDK: `index.js`
        *   Collector API: `api/` (excluding `public/` assets)
        *   CLI Binary: `bin/tokentalos.js`
4.  **Collector API Access:**
    *   Ensure the API can be started independently via the CLI for users who wish to submit usage data via HTTP.
5.  **CLI/SDK Verification:**
    *   Verify that `npx @meller/tokentalos start collector` works from a fresh installation.
    *   Verify that the library can be imported correctly.

## Non-Functional Requirements
*   **Package Size:** Minimize bundle size by explicitly excluding all dashboard assets and source code.
*   **ESM Compatibility:** Maintain the Pure ESM architecture.

## Acceptance Criteria
*   The package `@meller/tokentalos` is successfully published to npm at version `1.0.0`.
*   The package is publicly accessible.
*   Users can start the Collector API via the CLI.
*   The dashboard UI is NOT present in the package.

## Out of Scope
*   Dashboard UI (source or pre-built).
*   Automatic CI/CD pipeline setup.
