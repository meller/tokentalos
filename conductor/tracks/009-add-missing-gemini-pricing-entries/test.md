# Tests: Track 009 — Add Missing Gemini Pricing Entries

## Test Commands
```bash
node --check lib/engine/pricing.js
node -e "import('./lib/engine/pricing.js').then(({getCostCalculator}) => { const c = getCostCalculator(); for (const m of ['gemini-3.5-flash','gemini-2.5-flash','gemini-2.5-pro']) console.log(m, c.calculateCost('gemini', m, 1000000, 1000000)); })"
```

## Test Cases

### Feature: Gemini pricing coverage
- [x] TC-1: `gemini-3.5-flash` resolves to `[1.50, 9.00]` for 1M/1M input/output tokens.
- [x] TC-2: `gemini-2.5-flash` resolves to `[0.30, 2.50]`.
- [x] TC-3: `gemini-2.5-pro` resolves to `[1.25, 10.00]` (flat-rate ≤200K approximation).
- [x] TC-4: All three resolve through the `gemini` → `google` provider alias (`normalizeProvider`),
      not just the literal `google` key.
- [ ] TC-5: Real end-to-end call produces a non-zero-cost `usage_data` row — not run this pass.

## Acceptance Criteria
- [x] No more silent `[0, 0]` cost for these three models.
- [x] `node --check` clean.
- [ ] End-to-end `usage_data` verification — not done, disclosed.
