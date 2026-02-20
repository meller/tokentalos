# Implementation Plan: Publish Token Talos to npm

## Phase 1: Manifest & Registry Preparation
Configure the project for its first public release.

- [x] Task: Registry and Access Configuration
    - [x] Remove `publishConfig` for GitHub Packages from `package.json`.
    - [x] Add `publishConfig` targeting the public npm registry.
    - [x] Update `package.json` version to `1.0.0`.
- [x] Task: Bundle Optimization
    - [x] Update the `files` array in `package.json` to include only essential components (Engine, SDK, API code, CLI).
    - [x] Explicitly exclude `api/public/` and `dashboard/` from the bundle.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Manifest Preparation' (Protocol in workflow.md)

## Phase 2: Dependency & Binary Cleanup
Ensure the environment is clean for publication.

- [x] Task: Dependency Verification
    - [x] Run `npm install` to synchronize `package-lock.json`.
    - [x] Verify that all required dependencies for the CLI and Collector API are present in the root `package.json`.
- [x] Task: Binary Integrity
    - [x] Verify the `bin` entry in `package.json` points correctly to `bin/tokentalos.js`.
    - [x] Ensure the binary has appropriate execution permissions.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Cleanup' (Protocol in workflow.md)

## Phase 3: Final Verification & Publication
Perform pre-flight checks and publish to npm.

- [x] Task: Pre-Publication Check
    - [x] Run `npm pack --dry-run` to inspect the bundle contents.
    - [x] Verify that no dashboard assets or internal configuration files are included.
- [x] Task: NPM Publication
    - [x] Run `npm publish --access public`.
- [x] Task: Post-Publication Verification
    - [x] Perform a clean install in a temporary directory: `npm install @meller/tokentalos`.
    - [x] Verify the SDK can be imported and the CLI `start collector` command executes successfully.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Publication' (Protocol in workflow.md)
