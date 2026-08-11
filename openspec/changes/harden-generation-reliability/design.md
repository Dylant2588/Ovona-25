## Context

The current pipeline asks the LLM for meal concepts, then derives portions and macros from Supabase ingredient records. Missing ingredients and default-zero nutrition values currently flow through as valid zero-macro meals. The route receives client preferences but the orchestrated pipeline rebuilds context only from persisted rows. Allergy parsing also omits the live `user_allergies.allergy_name` column, and unsafe meals can remain when no alternative is available. See proposal.md and the associated specs for the required behavior.

## Goals / Non-Goals

**Goals:**

- Establish nutrition data—not LLM prose—as the authority for displayed meal macros.
- Make allergy handling fail closed across all generation sources.
- Reconcile current request preferences with authenticated persisted preferences in one explicit context-building path.
- Make an invalid or incomplete plan observable, actionable, and impossible to mistake for a usable plan.

**Non-Goals:**

- Achieving clinical nutrition precision or building a full food-data import product.
- Redesigning the meal planner UI beyond the validation and recovery states needed for reliable dogfooding.
- Automatically regenerating plans after page loads or failed writes.

## Decisions

### Use a verified ingredient baseline and fail closed on macro gaps

Seed and maintain nutrition records for every ingredient reachable from the static fallback library, then resolve generated ingredients against that data using normalized aliases. A meal is eligible only when its resolved macro totals are positive and complete.

This is preferred to accepting LLM-provided meal macros because deterministic ingredient calculations are auditable and can be corrected without prompt drift. It is also preferred to silently assigning estimates because the product's core value is target adherence.

### Separate concept creation from final-plan acceptance

The LLM and fallback library can propose concepts, but a final acceptance gate will validate: ingredient resolution, non-zero macro totals, allergy conflicts, and daily target assessment. An unsafe or incomplete concept must be replaced or the plan must return a structured incomplete result.

This prevents the current behavior in which validation discovers an unsafe concept but still returns it if an alternative is absent.

### Reconcile preferences before context construction

The generation route will authenticate the request, combine the request's current preference snapshot with persisted user data under one documented precedence order, and pass that resolved context to all generation paths. Allergies will union supported sources, including `user_allergies.allergy_name`.

This is preferred to relying only on database reads, which can ignore a newly saved/requested change, and to trusting browser input alone, which would risk stale or manipulated preference state.

### Keep generation user-initiated and writes single-attempt

Page load retrieves existing plan state only. Generation, swaps, and regeneration remain explicit user actions, and side-effecting requests do not automatically retry.

This preserves the token-spend safeguard already introduced during production dogfooding.

### Treat charts as projections of validated meal totals

The chart consumes the same totals already accepted by the final-plan gate; it does not invent or repair nutrition values. An incomplete plan presents an actionable validation state rather than a misleading zero chart.

## Risks / Trade-offs

- [Ingredient data is incomplete or aliases do not match generated names] → Seed the fallback ingredient set, add alias normalization, and return an explicit incomplete result for unresolved concepts.
- [Strict allergy checks reduce available meal variety] → Generate and validate additional safe alternatives before returning a plan; never relax an allergy constraint.
- [Request and persisted preferences conflict] → Define and test a stable precedence order, record the resolved signature, and surface a conflict/loading failure rather than silently defaulting.
- [A stricter acceptance gate yields fewer immediately available plans] → Prefer a clear retry/recovery state over a meal plan with false macros or unsafe ingredients.

## Migration Plan

1. Audit the live ingredient records against all fallback and seed meal ingredients, then add a version-controlled nutrition/alias seed migration.
2. Implement context reconciliation and correct allergy-column parsing.
3. Add the final acceptance gate and explicit incomplete-plan response.
4. Wire planner states and charts to accepted plans only.
5. Add regression tests and run production smoke checks for a Dairy-allergy user and a custom macro target.

**Rollback:** Revert the application deployment if the validation gate causes unexpected generation failures. Do not remove nutrition records or user preference data; they are additive correctness data.
