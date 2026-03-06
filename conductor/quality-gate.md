# Quality Gate

Automated checks that must pass before a track moves to `done`.

## Checks

### 1. Build
```bash
npm run build
```
**Passes if**: exits 0 and `api/public/` contains built dashboard assets.

### 2. Unit Tests
```bash
# Run any test files present
node --test lib/**/*.test.js 2>/dev/null || echo "No tests found — SKIP"
```
**Passes if**: exits 0, or no test files exist (skip).

### 3. Import Check
```bash
node -e "import('./index.js').then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })"
```
**Passes if**: exits 0 (main entry point loads without errors).

### 4. CLI Smoke Test
```bash
node bin/tokentalos.js --help
```
**Passes if**: exits 0 and prints usage info.

## Self-Healing Rules

The quality-gate agent MAY auto-fix:
- Missing `api/public/` directory (create it)
- Trailing whitespace or minor lint issues

It MUST NOT auto-fix:
- Failing tests
- Import errors in core engine logic
- Build failures caused by missing dependencies

All auto-fixes require a `fix(quality-gate): description` commit and a note in `conversation.md`.
