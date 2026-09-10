# Phase 7: Build deterministic personal meal orchestration engine - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the individual-user meal-orchestration engine behind Ovona's “Just plan my week” flow. It must turn a saved user profile into a complete, practical seven-day plan; validate it deterministically; allow one meal to be replaced without rebuilding the week; and emit an aggregated shopping list. Recipe browsing, social features, family optimisation, clinical recommendations, and LLM-owned constraint enforcement are outside this phase.

</domain>

<decisions>
## Implementation Decisions

### Profile and constraint contract
- **D-01:** Normalize the planner input into an explicit profile containing calorie target, protein target, allergies, dislikes, dietary rules, budget sensitivity, cooking-time preference, household size, and preferred meal types.
- **D-02:** Model hard constraints separately from soft preferences. Allergies and dietary prohibitions are non-negotiable; calorie/protein bands, required meal slots, and cooking-time limits are deterministic validation rules.
- **D-03:** Preserve the current individual-user focus. Household size scales portions and shopping quantities; it does not introduce multi-person preference optimisation.

### Deterministic weekly planning
- **D-04:** Produce a seven-day breakfast, lunch, dinner, and optional snack schedule from candidate meals without requiring the user to choose each recipe.
- **D-05:** Score candidates using nutrition fit, preference fit, ingredient reuse, prep effort, cost, and recent repetition. Use deterministic numeric scoring with inspectable score components.
- **D-06:** Prevent excessive identical or highly similar meals while permitting an explicitly marked batch-cook/leftover sequence when it improves practicality.
- **D-07:** Run a deterministic post-schedule validation and repair pass that rejects hard-constraint violations and checks daily calorie/protein tolerance bands.

### Regeneration and explanations
- **D-08:** Replace one meal against the existing week context rather than regenerating the entire plan. The replacement must obey the same hard constraints and avoid repeating the meal it replaces.
- **D-09:** Attach a concise explanation to generated/swap meals that names the practical reasons selected, such as leftovers, target contribution, and preparation time. Explanations are derived from deterministic scoring data.
- **D-10:** Keep LLM use optional and isolated behind an adapter for future soft-preference parsing or qualitative similarity ranking; an LLM must never decide safety, nutrition correctness, quantities, or constraint validity.

### Shopping aggregation and verification
- **D-11:** Aggregate all selected recipes into a week shopping list, scale quantities for household size, merge normalized duplicates, and distinguish pantry staples from items to buy.
- **D-12:** Add automated tests for allergy exclusion, protein/calorie tolerance, repetition/leftover rules, single-meal replacement, and scaled shopping-list aggregation.

### the agent's Discretion
- Exact tolerance defaults and score weights, provided they are centralized, configurable, and covered by tests.
- Whether to adapt existing generation types or introduce a new planner-specific module boundary, provided legacy routes remain compatible.
- Exact UI wording and presentation for the existing planner's “Just plan my week” entry point.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and requirements
- `.planning/PROJECT.md` — Core value, individual-user scope, resilience constraints, and existing planner intent.
- `.planning/REQUIREMENTS.md` — Existing nutrition, planning, and shopping-list requirements that the engine must preserve.
- `.planning/ROADMAP.md` — Phase ordering and compatibility with prior planner, shopping, and reliability work.
- `.planning/STATE.md` — Current project state and in-flight-work warning.

### Architecture and current planner implementation
- `.planning/codebase/ARCHITECTURE.md` — Existing planner/generation layers and request flow.
- `.planning/codebase/CONVENTIONS.md` — TypeScript, API, fallback, and error-handling conventions.
- `frontend-new/lib/generation/types.ts` — Shared generation contracts to preserve or extend.
- `frontend-new/lib/generation/generate-plan.ts` — Current generation orchestration integration point.
- `frontend-new/lib/meal-generator.ts` — Deterministic fallback and existing meal data model.
- `frontend-new/lib/macro-enforcement.ts` — Existing macro targeting and correction behavior.
- `frontend-new/lib/generation/validation-gate.ts` — Existing validation pattern.
- `frontend-new/app/api/meal-plan/route.ts` — Weekly-plan route contract.
- `frontend-new/app/api/meal-plan/swap/route.ts` — Single-meal replacement route contract.
- `frontend-new/app/api/shopping-list/route.ts` — Shopping list persistence/pricing integration.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend-new/lib/generation/*` already separates context building, generation, practical adjustments, validation, storage, and fallbacks.
- `frontend-new/lib/macro-enforcement.ts` and `frontend-new/lib/meal-generator.ts` provide the existing deterministic nutrition/fallback starting points.
- Existing `/api/meal-plan`, `/api/meal-plan/swap`, and `/api/shopping-list` routes provide integration contracts that should remain usable.

### Established Patterns
- Shared business logic lives under `frontend-new/lib`; routes are thin orchestrators and return structured JSON.
- Fallback-first generation is preferred when AI or external services fail.
- Strict TypeScript and explicit domain types are standard.

### Integration Points
- The orchestration engine must plug into `lib/generation/generate-plan.ts` and the weekly/swap API routes.
- Shopping aggregation must remain compatible with the current shopping-list route and price summary.
- The existing meal planner page is the likely presentation surface for the one-button weekly planning entry point and explanations.

</code_context>

<specifics>
## Specific Ideas

- The intended product signature is: “Just plan my week.” One action should produce a week that is acceptable 80–90% of the time.
- The architectural sequence is: profile → constraints → candidate meals → scoring → schedule optimiser → validation → shopping list.
- This work is deliberately more valuable than expanding recipe browsing, social features, or open-ended AI chat.

</specifics>

<deferred>
## Deferred Ideas

- LLM preference parser and qualitative meal-similarity ranker — add only after the deterministic engine is reliable.
- Multi-member household constraint resolution — future family-planning phase.
- Condition-aware clinical nutrition and micronutrient guidance — future clinically validated phase.

</deferred>

---
*Phase: 07-build-deterministic-personal-meal-orchestration-engine*
*Context gathered: 2026-09-10*
