# Phase 8: Trusted AI meal generation, rotation memory, and budget-aware retailer planning - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning
**Source:** Product direction captured in conversation

<domain>
## Phase Boundary

Build the core weekly planning loop for an individual: generate a varied,
practical week from their goals, dietary preferences, allergies, and budget;
show which retailer basket is the best fit after the meals are chosen.

The system must use AI for useful meal composition and variety, but it must
not treat model output as trusted nutrition, allergen, ingredient, or price
evidence. Only checked recipe and pricing records may support user-facing
claims.
</domain>

<decisions>
## Implementation Decisions

### Trusted AI generation
- OpenAI may propose meal combinations and turn a reviewed recipe record into
  a tailored weekly plan.
- Every proposed meal must be checked against persisted preference, dietary,
  allergy, ingredient, nutrition, and method evidence before the plan can be
  stored or shown as checked.
- A failed or incomplete check keeps the existing plan unchanged and exposes a
  clear reason; there is no silent fallback to unreviewed AI recipes.
- The recipe library needs provenance, versioned review status, ingredients,
  method, nutrition evidence, and an approval workflow suitable for trusted
  source imports.

### Rotation and low cognitive load
- Look back over the previous fourteen days of accepted/eaten plan meals.
- Avoid repeating the same named recipe during that period where a suitable
  alternative exists; actively vary protein source, cuisine, and format.
- Users do not curate recipes one at a time. Generation should make the week
  for them, with swap/regenerate available after the fact.

### Budget and retailers
- The user sets a general weekly food budget, not a mandatory retailer before
  generation.
- After meals are selected, compare evidence-backed baskets and present the
  best retailer/basket plus price confidence and unmatched items.
- Do not say a basket is cheapest or within budget when prices are estimates,
  stale, incomplete, or lack retailer provenance.

### Existing product decisions
- A declared Meal out is allowed as a nutrition-unknown exception, excluded
  from the shopping list, and visibly distinct from approved recipes.
- Individual-user POC remains the scope. Household, family and medical
  expansion remain later work.

### the agent's Discretion
- Which trusted source ingestion format to use first.
- Whether AI ranks reviewed candidates, creates a structured candidate draft,
  or both, provided it cannot bypass approval.
- UI placement and exact presentation for budget and confidence states.
</decisions>

<canonical_refs>
## Canonical References

### Current generation and approval boundary
- `frontend-new/lib/generation/context-builder.ts` — collects targets, saved preferences, budget and two-week history.
- `frontend-new/lib/generation/nutritionist.ts` — existing OpenAI concept-generation implementation.
- `frontend-new/lib/generation/generate-plan.ts` — current reviewed-library generation path.
- `frontend-new/lib/recipes/approval.ts` — recipe evidence and meal identity validator.
- `frontend-new/lib/recipes/plan-boundary.ts` — mandatory authorization/persistence gate.
- `frontend-new/supabase/migrations/20260217_generation_pipeline.sql` — history and generation schema foundation.

### Budget and shopping
- `frontend-new/lib/generation/practical-engine.ts` — budget adjustment logic.
- `frontend-new/lib/tesco-prices.ts` — current single-retailer local pricing source.
- `frontend-new/app/api/shopping-list/route.ts` — persisted shopping-list behavior.
</canonical_refs>

<specifics>
## Specific Ideas

- User experience: set a general budget → generate meals → show where is best to shop.
- The intended promise is “do not think about food” while still hitting calorie
  and protein goals.
</specifics>

<deferred>
## Deferred Ideas

- Family and household planning.
- Health-condition expansion beyond existing explicit constraints.
- Social sharing; only the single-user Meal out exception is in current scope.
</deferred>

---

*Phase: 08-build-trusted-ai-meal-generation-rotation-memory-and-budget-*
*Context gathered: 2026-10-13*
