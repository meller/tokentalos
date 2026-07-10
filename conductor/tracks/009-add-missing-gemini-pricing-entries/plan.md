# Track 009: Add Missing Gemini Pricing Entries

## Phase 1: Add the three missing entries

**File**: `lib/engine/pricing.js`

- [x] Fetched real current pricing from Google Cloud's official Vertex AI pricing page (not
      estimated/guessed).
- [x] Added `gemini-3.5-flash` (1.50/9.00), `gemini-2.5-flash` (0.30/2.50), `gemini-2.5-pro`
      (1.25/10.00, flat-rate approximation of the real ≤200K tier — documented via inline comment
      since the calculator has no tiering support).
- [x] `node --check lib/engine/pricing.js` — clean.

## Phase 2: Verify

- [x] Ran `CostCalculator.calculateCost('gemini', model, 1_000_000, 1_000_000)` for all three new
      models directly — confirmed each resolves through the existing `gemini` → `google` provider
      alias to the correct non-zero input/output cost (1.50/9.00, 0.30/2.50, 1.25/10.00
      respectively), not the previous silent `[0, 0]`.
- [ ] **Not done**: end-to-end verification via a real LLM call through the full
      `TokenTalos.execute()` → `ingest()` path, confirming a real `usage_data` row shows non-zero
      cost — this pass only verified the calculator function in isolation, not the full pipeline.

## ✅ COMPLETE

Pricing entries added and verified at the calculator level. End-to-end `usage_data` row
verification not done — disclosed, low-risk given `ingest()`'s cost computation
(`lib/engine/index.js`) calls the same `calculateCost` path already verified here.
