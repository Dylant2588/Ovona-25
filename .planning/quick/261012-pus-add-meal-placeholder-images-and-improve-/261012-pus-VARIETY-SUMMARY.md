# Recipe variety task

Added ten distinct measured-ingredient recipes: spinach scramble, turkey pepper omelette, banana oat pancakes, pepper egg bites, turkey cucumber rolls, chicken pepper skewers, chicken tomato pasta, chicken noodle stir-fry, turkey bean wraps, and chicken vegetable soup. Existing allergy filtering and nutrition tolerances remain in force. Egg whites, banana and wholewheat pasta have explicit nutrition mappings; every new recipe has executable preparation steps and a realistic total time. Ingredient nutrition is approximate, as in the existing static catalogue.

The generator uses the shared illustration resolver when constructing meal instances. Both conversion paths in generation/generate-plan.ts also persist semantic artwork into the existing image field. No database migration is needed.

Swaps now exclude the original recipe as well as the day's other recipes, while existing preference-safe fallback remains available for genuinely limited pools.

## Verification

- Existing fallback harness now checks five deterministic random values with unchanged 1,830 kcal / 216g protein targets and Dairy, Nuts, Fish, Shellfish and Sesame exclusions.
- Each restricted week has at least three ingredient-and-step-distinct breakfasts, three snacks and four mains. Each day has distinct snacks and distinct lunch/dinner recipes.
- Five-seed swaps change breakfast, retain nutrition fit, and retain hard exclusions.
- Local semantic illustration paths persist in each generated meal.
- Twenty-five fresh random harness runs passed across two repeated batches (15 + 10); the latter includes the swap assertions.
- New tests/orchestration/meal-variety.test.ts invokes the substantive harness directly; its focused test passes.
- Enforcement regressions check already-passing meal portions are unchanged, stale cached totals cannot bypass actual nutrition checks, and unsafe portions cannot receive a passing result unchanged. The parent owns the corresponding macro-enforcement fixes.
- Changed catalogue/generator/test/harness lint passes. generation/generate-plan.ts has 13 pre-existing unused-symbol warnings, zero errors.

## Files

- New: frontend-new/lib/varied-meal-catalogue.ts; frontend-new/tests/orchestration/meal-variety.test.ts.
- Modified: frontend-new/lib/meal-generator.ts; frontend-new/scripts/fallback-regression-test.cjs; frontend-new/lib/generation/generate-plan.ts.
- Preserved pre-existing uncommitted generator and regression edits. Parent should stage only this task's hunks in overlapping files.

## Deviations and limits

New catalogue module keeps recipe data separate without changing the existing generation architecture. New recipe diversity exposed enforcement's mutation of already-valid days; parent fixed this under correctness Rule 1 without expanding tolerances. Pure plant meals remain harder to fit at this restrictive protein density, so the expanded high-protein pool relies on eggs and lean poultry. Current estimate coverage remains Tesco; these changes introduce no retailer-selection gate and no cross-retailer recommendation claims.

## Self-Check: PASSED

New catalogue and focused test exist and focused verification passed. This task report does not claim a deployed change or a database backfill.
