## Why

The deployed planner can return meals with zero nutrition totals and can suggest foods that conflict with a recorded allergy. This undermines Ovona's core promise—reliable calorie/protein adherence with low decision-making—and makes daily dogfooding unsafe and misleading.

## What Changes

- Make generated meal plans nutritionally complete before they are returned: every displayed meal requires resolved, non-zero macros and the final daily totals must be assessed against the user's targets.
- Establish a verified nutrition-data baseline for ingredients used by the generation pipeline, with deterministic handling when an ingredient cannot be resolved.
- Treat allergies as hard safety constraints across saved preferences, LLM output, static fallbacks, alternatives, and final plans; never display an unsafe meal as an acceptable fallback.
- Ensure the generation route uses the preferences supplied for the request while reconciling them with the persisted profile.
- Add regression coverage and diagnostic results for macro completeness, target adherence, and preference/allergy compliance.

## Capabilities

### New Capabilities

- `nutrition-complete-plans`: Generated plans contain resolvable meal macros and report meaningful target-adherence results.
- `allergy-safe-generation`: Every generated, fallback, swap, and replacement meal respects a user's recorded allergies.
- `generation-preference-integrity`: Plan generation uses the current saved/requested preferences consistently and exposes validation failures rather than silently reverting to defaults.

### Modified Capabilities

- None.

## Impact

- Affected code: meal-plan API routes, generation context, nutrition/portion engine, validation gate, fallback library, macro enforcement, planner loading/error states, and ingredient seed/migration data.
- Affected data: `ingredients`, `user_preferences`, `profiles`, `user_allergies`, `meal_concepts`, and persisted plan state.
- Affected external systems: Supabase remains the nutrition and preference source of truth; OpenAI remains limited to concept generation rather than nutritional truth.
