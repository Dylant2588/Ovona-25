## Why

The reliable fallback plan now shows real macros, but it repeats a small set of meals and can materially miss a user's daily calorie target. The current macro chart also combines calorie and gram values in one crowded view, making adherence difficult to understand at a glance.

## What Changes

- Introduce a controlled meal-variety system: use the AI nutritionist to propose new concepts within the user's hard constraints, then accept only concepts with resolvable ingredients and validated nutrition.
- Expand the verified fallback meal catalogue and use rotation rules to avoid repeated meals and protein sources across a week.
- Require accepted daily totals to meet configurable calorie and protein tolerances, with a correction/recovery pass before a plan is shown.
- Replace the mixed-unit macro chart with an adherence-first view that clearly distinguishes calories from gram-based macro targets.

## Capabilities

### New Capabilities

- `validated-meal-variety`: Produces a varied weekly rotation using AI-proposed and catalogue meals without bypassing nutrition or allergy validation.
- `daily-target-adherence`: Accepts and presents plans only after daily calorie and protein totals have been assessed and corrected within defined tolerances.
- `macro-adherence-visualization`: Shows calorie and macro adherence in a legible, target-oriented planner visual.

### Modified Capabilities

- None.

## Impact

- Affected code: generation nutritionist, fallback library, macro enforcement, meal-plan API response, and `app/meals/page.tsx` chart and summary components.
- Affected data: verified ingredient baseline, `meal_concepts`, and user meal history used for rotation.
- OpenAI continues to create meal concepts only; deterministic nutrition and safety gates remain the authority for plan acceptance.
