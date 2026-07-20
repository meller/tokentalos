# Spec: Track 014 — Configurable Gemini thinking level

## Context

`gemini-3.5-flash` (this session's default model, per coachai's own A/B-tested choice) defaults to
`thinking_level: medium` — a real, internal reasoning phase that consumes hundreds to thousands
of tokens per call before producing visible output. Confirmed via `@google/genai`'s own docs:
thinking is on by default for this model and cannot be fully disabled, only reduced via a
qualitative `thinkingLevel` (`MINIMAL`/`LOW`/`MEDIUM`/`HIGH`) — not the token-count-based
`thinkingBudget`, which was tested first and found unreliable (a requested 512-token budget still
produced ~768 actual thinking tokens for this model).

**Real measurement** (coachai, same representative real prompt, matching the app's actual call
shape — `temperature` only, no `max_tokens` cap):

| Setting | Trial 1 | Trial 2 | Trial 3 | Trial 4 |
|---|---|---|---|---|
| Default (medium) | 28,857ms (thoughts: 3,227) | 24,761ms (thoughts: 2,827) | 28,917ms (thoughts: 3,633) | — |
| `thinkingLevel: MINIMAL` | 8,177ms (thoughts: none) | 12,452ms (thoughts: none) | 16,330ms (thoughts: none) | — |

45-70% faster on every trial, no overlap between the two distributions. Output length was
comparable (1,019-1,260 tokens for MINIMAL vs. 1,120-1,176 for default) — MINIMAL is not
producing truncated or noticeably shorter responses. `<<<DIAGRAM_START/END>>>` and
`<<<TERMS_USED/END>>>` markers were present and well-formed in **100% of trials at both
settings** — no marker-compliance regression. Domain-term usage (shadow/projection/complex named
with real mechanism explanations, not just labels) was present in both settings' sample outputs.

## Requirements

- REQ-1: Add an engine-level config: `config.llmThinkingLevel` (`'MINIMAL'`, `'LOW'`, `'MEDIUM'`,
  `'HIGH'`). **Defaults to `'MINIMAL'` when not explicitly set** — per the strength of the
  evidence above (45-70% faster with no observed quality/marker-compliance loss across every
  trial), this package now ships an opinionated, cost/speed-conscious default rather than
  silently inheriting the model's own `medium` default. A consumer that wants the model's native
  default back (or a higher reasoning level) can still explicitly pass `llmThinkingLevel: null`
  (meaning: omit `thinkingConfig` entirely, i.e. today's pre-Track-014 behavior) or any other
  explicit level. Distinguish `undefined` (not set at all → defaults to `'MINIMAL'`) from
  `null` (explicitly opted out → no `thinkingConfig` sent) — `??` won't do this, use an explicit
  `'llmThinkingLevel' in this.config ? this.config.llmThinkingLevel : 'MINIMAL'`-style check.
- REQ-2: Since `thinkingConfig` must be set per-call (confirmed via `@google/genai`'s type
  definitions — it lives in `GenerateContentConfig`, not `HttpOptions`), resolve the effective
  level once per call (`options.thinkingLevel` override, else `config.llmThinkingLevel`, else the
  `'MINIMAL'` package default per REQ-1) and thread it into the `config: {...}` object in all
  four call sites (`executeVertex`, `streamExecuteVertex`, `executeGemini`,
  `streamExecuteGemini`) as `thinkingConfig: { thinkingLevel: resolvedLevel }` — but only when
  `resolvedLevel` is not `null` (an explicit `null` at either the per-call or engine-config level
  means "send no `thinkingConfig` at all," restoring pre-Track-014/model-native behavior).
- REQ-3: Per-call override (`options.thinkingLevel`) takes precedence over the engine-level
  `config.llmThinkingLevel`, which takes precedence over the `'MINIMAL'` package default —
  same precedence chain as `abortSignal`/`gcpProjectId`.
- REQ-4: **This is a deliberate behavior change from pre-Track-014**, not a purely additive one
  — a consumer that does nothing now gets `thinkingLevel: MINIMAL` instead of the model's native
  `medium`. This is intentional per the strength of the evidence (REQ-1) and should be called out
  clearly in the changelog/release notes, not buried as an implementation detail — a consumer
  relying on default `medium` reasoning quality needs to know to opt out explicitly
  (`llmThinkingLevel: null`).
- REQ-5: No change to `httpOptions.timeout`/`retryOptions` (Track 013) or `abortSignal` handling
  — this is a separate, additive field in the same `config` object.

## Non-Goals

- Configuring `thinkingBudget` (the token-count control) — confirmed unreliable for this model,
  not pursued further; `thinkingLevel` is the correct lever.
- Anthropic/OpenAI/DeepSeek — Gemini-specific concept, not applicable to those providers.
- Applying this to models/providers where `thinkingConfig` might not be a supported field —
  scoped to Gemini/Vertex only (`executeVertex`/`streamExecuteVertex`/`executeGemini`/
  `streamExecuteGemini`), same four call sites Track 013 touched.

## Acceptance Criteria

- [ ] A call with `config.llmThinkingLevel` unset (not passed at all) now sends
      `thinkingConfig: { thinkingLevel: 'MINIMAL' }` — the new package default.
- [ ] A call with `config.llmThinkingLevel: null` sends no `thinkingConfig` at all (explicit
      opt-out, restoring pre-Track-014 behavior).
- [ ] A call with `config.llmThinkingLevel: 'MINIMAL'` (explicit or defaulted) produces a real,
      measurable speedup on a representative prompt, reproducing (not just theoretically
      enabling) the finding above.
- [ ] A per-call `options.thinkingLevel` override works and takes precedence over both the
      engine-level config and the package default.
- [ ] Existing tests (`test-vertex-genai.js`, `test-stream-reporting.js`) still pass — note their
      *expected* timing baselines will now be faster than before this track, since they don't
      set `llmThinkingLevel` and will get the new `MINIMAL` default; re-verify they still pass
      functionally, don't just assume unchanged timing.
- [ ] Verified from coachai via the `npm link` already in place — coachai does nothing extra and
      automatically gets `MINIMAL` by default.
