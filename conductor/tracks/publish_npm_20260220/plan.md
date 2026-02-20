# Implementation Plan: Publish Token Talos to npm

## Phase 1: Manifest & Registry Preparation
Configure the project for its first public release.

- [ ] Task: Registry and Access Configuration
    - [ ] Remove `publishConfig` for GitHub Packages from `package.json`.
    - [ ] Add `publishConfig` targeting the public npm registry.
    - [ ] Update `package.json` version to `1.0.0`.
- [ ] Task: Bundle Optimization
    - [ ] Update the `files` array in `package.json` to include only essential components (Engine, SDK, API code, CLI).
    - [ ] Explicitly exclude `api/public/` and `dashboard/` from the bundle.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Manifest Preparation' (Protocol in workflow.md)

## Phase 2: Dependency & Binary Cleanup
Ensure the environment is clean for publication.

- [ ] Task: Dependency Verification
    - [ ] Run `npm install` to synchronize `package-lock.json`.
    - [ ] Verify that all required dependencies for the CLI and Collector API are present in the root `package.json`.
- [ ] Task: Binary Integrity
    - [ ] Verify the `bin` entry in `package.json` points correctly to `bin/tokentalos.js`.
    - [ ] Ensure the binary has appropriate execution permissions.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Cleanup' (Protocol in workflow.md)

## Phase 3: Final Verification & Publication
Perform pre-flight checks and publish to npm.

- [ ] Task: Pre-Publication Check
    - [ ] Run `npm pack --dry-run` to inspect the bundle contents.
    - [ ] Verify that no dashboard assets or internal configuration files are included.
- [ ] Task: NPM Publication
    - [ ] Run `npm publish --access public`.
- [ ] Task: Post-Publication Verification
    - [ ] Perform a clean install in a temporary directory: `npm install @meller/tokentalos`.
    - [ ] Verify the SDK can be imported and the CLI `start collector` command executes successfully.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Publication' (Protocol in workflow.md)
