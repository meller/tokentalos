# Track 009: Add Missing Gemini Pricing Entries

**Summary**: `PRICING_DATA.google` (`lib/engine/pricing.js`) was missing entries for `gemini-3.5-flash`, `gemini-2.5-flash`, and `gemini-2.5-pro` — all three confirmed live/in-use by a downstream project (coachai). Added accurate current pricing sourced from Google Cloud's official Vertex AI pricing page.

## Problem

`CostCalculator.calculateCost()` returns `[0, 0]` silently when a model has no pricing entry
(`lib/engine/pricing.js:75-76` — `if (!modelPricing) return [0, 0];`). Any call using
`gemini-3.5-flash`, `gemini-2.5-flash`, or `gemini-2.5-pro` was tracked with **zero cost** in
`usage_data`, not an error — a silent data-quality gap in cost tracking, not a crash.

Confirmed all three are real, in-use models: the coachai project (a downstream consumer of this
package) just switched its default aid-mode chat model to `gemini-3.5-flash` (its own Track 096)
after A/B-testing it against `gemini-2.5-flash` (its prior default) and `gemini-2.5-pro`.

## Fix

Added to `PRICING_DATA.google`, sourced from Google Cloud's official Vertex AI Generative AI
pricing page (fetched live, not estimated):

- `gemini-3.5-flash`: input $1.50, output $9.00 per 1M tokens (global tier).
- `gemini-2.5-flash`: input $0.30, output $2.50 per 1M tokens.
- `gemini-2.5-pro`: input $1.25, output $10.00 per 1M tokens — **caveat**: this model's real
  pricing is tiered by context size (≤200K tokens: 1.25/10.00, >200K tokens: 2.50/15.00, with the
  higher rate applying to ALL tokens once the threshold is crossed). `CostCalculator` has no
  tiering support at all (`calculateCost()` does flat `tokens * rate` multiplication with no
  context-length branching) — used the ≤200K rate flat, documented in a code comment. Under-counts
  cost for any single call exceeding 200K tokens; a real limitation of the calculator's design, not
  something this pass fixes (no other model in the table has tiered pricing either, so this isn't
  a regression — it's a pre-existing gap in the calculator's model, just newly relevant to a
  now-priced model).

## Acceptance Criteria

- [x] All three models resolve to non-zero, accurate cost via `CostCalculator.calculateCost()`.
- [x] `node --check lib/engine/pricing.js` clean.
- [ ] Live re-verification that a real `usage_data` row for one of these models now shows non-zero
      cost (needs a real call through the full ingest path, not just the calculator in isolation —
      not done this pass, disclosed).

## Out of Scope

- Adding tiered-pricing support to `CostCalculator` generally — a real gap, but a separate,
  larger feature (would need `calculateCost` to accept per-tier thresholds and branch on total
  token count). Noted, not built here.
