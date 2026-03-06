# TokenTalos Workflow

## Principles
1. **Local First:** All features should prioritize local execution.
2. **TDD:** Write tests for API logic and orchestrator components.
3. **Non-Interactive:** Core CLI must support non-TTY environments.

## Commit Strategy
- Conventional Commits: feat/fix/docs/refactor/test/chore
- Include track number: `feat(track-001): description`

## Branching Model
- main: production-ready
- feature branches: `track-NNN-description`
- public: sanitized public-facing branch

## Development Process
1. Create track with `/laneconductor newTrack`
2. Write spec.md before coding
3. Implement in phases with commits per phase
4. Update progress with `/laneconductor pulse`

## Quality Gates
- [ ] All tests pass (Jest/Vitest)
- [ ] Documentation updated
- [ ] CLI help updated for new commands
- [ ] `npm run build` succeeds

## Code Review
- Self-review before marking done
- Update plan.md with learnings after each phase

## Workflow Configuration
Machine-readable config lives in `conductor/workflow.json`.
Edit it directly or via `/laneconductor workflow set`.
See `conductor/workflow.json` for lane transitions, parallel limits, and model overrides.
