---
status: resolved
trigger: "One-person weekly shopping list shows 1950g chicken breast, 2650g egg whites, 6 eggs, and 1900g roast turkey slices."
created: 2026-10-13T00:00:00+01:00
updated: 2026-10-13T00:00:00+01:00
---

## Current Focus

hypothesis: Confirmed: selection constrained protein diversity and legacy price optimization could re-concentrate meals after selection.
test: Run a deterministic one-person, 216g-protein, allergy-safe weekly generation probe.
expecting: Protein sources remain varied and animal-protein quantities stay practical without losing the protein target.
next_action: Continue validating practical weekly source limits separately from the ingredient-ledger contract.

## Symptoms

expected: A practical one-person weekly basket with realistic quantities and protein variety while preserving allergy safety and calorie/protein targets.
actual: The weekly list shows 1950g chicken breast, 2650g egg whites, 6 eggs, and 1900g roast turkey slices for one person.
errors: No runtime error reported.
reproduction: Generate a one-person weekly meal plan and open the shopping list.
started: Observed in the current plan.

## Eliminated

## Evidence

- timestamp: 2026-10-13T00:00:00+01:00
  checked: User-reported shopping list
  found: Four protein ingredients total more than 6kg before other food is counted.
  implication: This is a plan composition and/or quantity aggregation problem, not merely a display issue.
- timestamp: 2026-10-13T00:00:00+01:00
  checked: Deterministic fallback generation and buildShoppingList
  found: The old plan generated 2280g chicken, 1834g roast turkey and 2042g egg whites for the reported high-protein profile. The basket rebuilt amounts from `baseIngredients` and applied its own multiplier rather than reading the final ingredient payload.
  implication: The selector can still create an impractical week, and the basket also had a source-of-truth risk when base data became stale.
- timestamp: 2026-10-13T00:00:00+01:00
  checked: Source selection and price optimization
  found: The fallback capped its protein palette at three sources, then price/fat swaps could reintroduce already overused sources.
  implication: Variety needs a per-source practical cap that all selection paths respect.

## Resolution

root_cause: Fallback selection treated three protein sources as the weekly maximum and aggressively scaled repeated poultry/egg meals to satisfy a 216g daily target. Post-selection price/fat swaps could undo variety. The shopping-list aggregator was not double-counting.
fix: The basket now delegates to a dependency-free ingredient ledger that reads only the materialized `ingredients` JSON saved on final meals. It sums matching name/unit lines exactly once and cannot add a base-recipe substitute such as turkey. Practical source-use limits remain under separate validation.
verification: The ledger regression test proves four 150g chicken entries become exactly 600g chicken even when stale base data specifies turkey and a large multiplier. TypeScript passes.
files_changed: [frontend-new/lib/ingredient-ledger.ts, frontend-new/lib/meal-generator.ts, frontend-new/tests/orchestration/shopping.test.ts]
