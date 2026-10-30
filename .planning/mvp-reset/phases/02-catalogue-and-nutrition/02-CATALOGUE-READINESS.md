# Catalogue readiness — observed evidence

Date: 2026-10-29. These are snapshot-based results, not a promise of universal feasibility.

## Existing hosted catalogue (read only)

A bounded query selected only approved `recipe_library.record` rows from the configured hosted project. No user preferences, meal plans or shopping data were queried or changed. No migrations or writes ran against that project.

Observed: **38 approved recipe identities, all legacy-attested; zero ingredient-calculated versions**. All passed the current structural/legacy compatibility checks. Source and method attestations remain the existing records' evidence; this task does not independently certify their original review.

Actual scheduler diagnostics in `02-hosted-reviewed-coverage.json`:

| Probe | Existing legacy-compatible recipes | Calculated-only recipes |
|---|---|---|
| Mixed, 3 meals, 2000 kcal / 150g protein, 30 min | Seven-day plan generated | No admitted calculated catalogue |
| Mixed, 5 meals, same targets | Indeterminate: bounded search-space guard | No admitted calculated catalogue |
| Vegetarian, 3 meals, same targets | No feasible result from this scheduler run | No admitted calculated catalogue |
| Vegan, 3 meals, same targets | No feasible result; broad plant-category cap also blocks complete days | No admitted calculated catalogue |
| Pescatarian, 3 meals, same targets | No feasible result from this scheduler run | No admitted calculated catalogue |
| Mixed, 3 meals, 15 min | No feasible result from this scheduler run | No admitted calculated catalogue |
| Restrictive mixed, 5 meals, 1830 kcal / 216g protein, 30 min | Indeterminate: bounded search-space guard | No admitted calculated catalogue |

Indeterminate does not mean infeasible. A failed deterministic run is not a mathematical proof that no possible plan exists. Existing safety, portion and nutrition tolerances were retained. Reports distinguish actual scheduling from counts and include rejection reasons and duplicate snack-slot demand.

## Prepared source-backed content

The official CoFID 2021 extraction pins workbook SHA256, exact food codes, nutrient cells and food states. Seven source rows are retained; olive-oil trace protein remains unknown rather than zero. No allergy conclusions are inferred from composition data.

One complete original pending demonstrator, Brown Rice, Spinach and Chickpea Bowl, uses exact raw brown rice, raw baby spinach and canned/reheated/drained chickpea mappings. Batch quantities divide into two servings; the stored calculator produces **373 kcal, 19g protein, 66g carbohydrate and 6g fat per serving**. This is an ingredient-source calculation, not a laboratory measurement or completed cook-through.

`frontend-new/data/recipes/calculated-pending.json` retains all review flags false and attribution null. Source rights, ingredient/supplier/allergen checks, method, timing and cook-through remain accountable human review tasks. It is not included as reviewed coverage. Its 35-minute preparation estimate also excludes it from the default 30-minute probes.

The separate internal export contains 38 pending estimated drafts (`02-existing-pending.json`); it is not the hosted approved catalogue. Neither that export nor the one prepared demonstrator establishes calculated-only weekly coverage. Reports: `02-existing-coverage.json`, `02-prepared-coverage.json`. The empty `02-PREPARATION-GAPS.json` applies only to the one completely mapped demonstrator, not all 38 existing recipes.

## Remaining content and product gates

1. Map the existing recipes to precise source foods, preparation states and any measured density/count conversions. Uncertain brands/composite foods need explicit evidence rather than taxonomy matching.
2. Prepare pending successor records, import them through the atomic authenticated route, and complete real review before approval. Existing approved versions remain immutable and available for historical plans.
3. Expand reviewed breakfast/snack and restrictive/quick-preparation coverage according to the diagnostic gaps; rerun the actual cohort reports after each reviewed batch.
4. Resolve the explicit plant-protein variety policy before claiming full vegan-week support. No false mixed-protein metadata or relaxed allergy/macro checks were introduced.

Software verification and real content readiness are separate. The phase may reach `software_verified/content_review_pending`; a reliable calculated-only catalogue is not yet complete. Phase 3 and hosted rollout remain outside this execution.
