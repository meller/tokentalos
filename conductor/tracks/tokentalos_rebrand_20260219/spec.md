# Specification: Project Rebranding - Token Wall to Token Talos

## Overview
Rename the project from "Token Wall" to "Token Talos" due to naming conflicts and to prepare for public release on GitHub. This track involves a comprehensive rebranding of the codebase, database, environment, and UI, as well as a transition to a GitHub-based package distribution to resolve module system conflicts.

## Functional Requirements
1.  **Project Renaming:**
    *   Rename the root directory from `tokentalos/` to `tokentalos/`.
    *   Rename all internal code symbols: Class `TokenTalos` becomes `TokenTalos`, `TokenTalosEngine` becomes `TokenTalosEngine`, etc.
    *   Update all internal comments and documentation references.
2.  **Environment & Database Rebranding:**
    *   Rename all environment variables (e.g., `TOKENWALL_DB_TYPE` becomes `TOKENTALOS_DB_TYPE`).
    *   Update the database schema name from `tokentalos` to `tokentalos`.
    *   Update table prefix/schema logic in the engine to point to the new namespace.
3.  **UI & Branding:**
    *   Update the Dashboard title, logos, and text references from "TokenTalos" to "Token Talos".
    *   Update the CLI binary name and help text.
4.  **Package Distribution:**
    *   Configure the project for publication as a GitHub Package.
    *   Ensure the package is Pure ESM.
    *   Update external consumer applications to consume `@<org>/token-talos` via GitHub instead of a local tarball.

## Non-Functional Requirements
*   **Module System:** Maintain Pure ESM architecture. Implement a dual-build (CJS/ESM) fallback only if integration conflicts occur.
*   **Repository Strategy:** Initialize a fresh git repository for "Token Talos" (no history preservation).

## Acceptance Criteria
*   The project root folder is named `tokentalos`.
*   All tests pass with the new `TokenTalos` namespace.
*   The Dashboard displays "Token Talos" branding.
*   External applications successfully import and execute the library via the GitHub package URL.
*   Database records are successfully stored in the `tokentalos` schema.

## Out of Scope
*   Migration of existing `tokentalos` schema data to `tokentalos` (starting fresh).
*   Implementing a dual-build system in the first pass (unless required by build failures).
