# Implementation Plan: Token Talos Rebranding

## Phase 1: Fresh Repository & Directory Setup
Initialize the new project identity.

- [ ] Task: Create new directory structure
    - [ ] Rename root folder from `tokentalos` to `tokentalos`.
    - [ ] Initialize a fresh git repository in the new folder.
- [ ] Task: Project Manifest Updates
    - [ ] Update `package.json` names (root, api, dashboard) to `@<org>/token-talos`.
    - [ ] Update package version and description.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Setup' (Protocol in workflow.md)

## Phase 2: Core Engine & API Renaming
Perform a global refactor of code symbols and configuration.

- [ ] Task: Symbol Refactoring
    - [ ] Rename Class `TokenTalos` -> `TokenTalos` across the codebase.
    - [ ] Rename Class `TokenTalosEngine` -> `TokenTalosEngine`.
    - [ ] Update internal variable names and comments.
- [ ] Task: Environment & Database Migration
    - [ ] Update all `process.env.TOKENWALL_*` references to `TOKENTALOS_*`.
    - [ ] Update default database schema name from `tokentalos` to `tokentalos` in `db.js`.
    - [ ] Update CLI binary entry in `package.json`.
- [ ] Task: Test Suite Update
    - [ ] Update all Jest tests to import and use the new `TokenTalos` namespace.
    - [ ] Run `npm test` to verify logic consistency.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Code Refactor' (Protocol in workflow.md)

## Phase 3: Dashboard & CLI Rebranding
Update the user-facing interfaces.

- [ ] Task: Dashboard UI Rebrand
    - [ ] Update titles, headings, and guide text in `App.tsx`.
    - [ ] Update logos or icons if applicable.
- [ ] Task: CLI Help & Setup Wizard
    - [ ] Update help text and command descriptions in `bin/tokentalos.js` (renamed to `bin/tokentalos.js`).
    - [ ] Update setup wizard strings in `api/setup.js`.
- [ ] Task: Build Verification
    - [ ] Run `npm run build` to ensure the dashboard compiles correctly with the new branding.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI/CLI' (Protocol in workflow.md)

## Phase 4: GitHub Publication & Consumer Integration
Transition to GitHub-based package distribution.

- [ ] Task: GitHub Package Configuration
    - [ ] Configure `.npmrc` for GitHub Packages.
    - [ ] Perform a test publish to a private GitHub repository.
- [ ] Task: External Consumer Integration
    - [ ] Update consumer `package.json` to point to the GitHub package URL for `@<org>/token-talos`.
    - [ ] Remove local tarball references.
    - [ ] Update consumer code to import from `@<org>/token-talos` and use the new class names.
- [ ] Task: Final Verification
    - [ ] Run integrated consumer application in development mode to ensure full end-to-end connectivity.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Publication' (Protocol in workflow.md)
