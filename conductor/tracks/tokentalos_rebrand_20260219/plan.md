# Implementation Plan: Token Talos Rebranding

## Phase 1: Fresh Repository & Directory Setup
Initialize the new project identity.

- [x] Task: Create new directory structure
    - [x] Sanitized track directories and documentation.
    - [x] Initialize a fresh git history (via commit --amend) on the `public` branch.
- [x] Task: Project Manifest Updates
    - [x] Update `package.json` names (root, api, dashboard) to `@<org>/token-talos`.
    - [x] Update package version and description to "The ORM for LLMs".
- [x] Task: Conductor - User Manual Verification 'Phase 1: Setup' (Protocol in workflow.md)

## Phase 2: Core Engine & API Renaming
Perform a global refactor of code symbols and configuration.

- [x] Task: Symbol Refactoring
    - [x] Rename Class `TokenTalos` -> `TokenTalos` across the codebase.
    - [x] Rename Class `TokenTalosEngine` -> `TokenTalosEngine`.
    - [x] Update internal variable names and comments.
- [x] Task: Environment & Database Migration
    - [x] Update all `process.env.TOKENWALL_*` references to `TOKENTALOS_*`.
    - [x] Update default database schema name from `tokentalos` to `tokentalos` in `db.js`.
    - [x] Update CLI binary entry in `package.json`.
- [x] Task: Test Suite Update
    - [x] Update all Jest tests to import and use the new `TokenTalos` namespace.
    - [x] Run `npm test` to verify logic consistency.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Code Refactor' (Protocol in workflow.md)

## Phase 3: Dashboard & CLI Rebranding
Update the user-facing interfaces.

- [x] Task: Dashboard UI Rebrand
    - [x] Update titles, headings, and guide text in `App.tsx`.
    - [x] Update logos or icons if applicable.
- [x] Task: CLI Help & Setup Wizard
    - [x] Update help text and command descriptions in `bin/tokentalos.js`.
    - [x] Update setup wizard strings in `api/setup.js`.
- [x] Task: Build Verification
    - [x] Run `npm run build` to ensure the dashboard compiles correctly with the new branding.
- [x] Task: Conductor - User Manual Verification 'Phase 3: UI/CLI' (Protocol in workflow.md)

## Phase 4: GitHub Publication & Consumer Integration
Transition to GitHub-based package distribution.

- [x] Task: GitHub Package Configuration
    - [x] Configure `.npmrc` for GitHub Packages.
    - [x] Perform a test publish to a private GitHub repository.
- [ ] Task: External Consumer Integration
    - [ ] Update consumer `package.json` to point to the GitHub package URL for `@<org>/token-talos`.
    - [ ] Remove local tarball references.
    - [ ] Update consumer code to import from `@<org>/token-talos` and use the new class names.
- [x] Task: Final Verification
    - [x] Pushed `public` branch to GitHub with clean history and sanitized content.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Publication' (Protocol in workflow.md)
