# Recipe catalogue operations

Run commands from `frontend-new`. Preparation and coverage commands read explicit JSON files only: they load no application environment, credentials, database clients or network sources. They do not approve recipes.

## Prepare reproducible pending nutrition

```powershell
node scripts/prepare-recipe-nutrition.ts --foods data/nutrition/cofid-2021-slice.json --mappings data/recipes/nutrition-mappings.json --actor local-preparation
```

Default output contains prepared records, per-recipe gaps and a SHA256 preparation manifest. The actor identifies preparation, not an importer or reviewer. To write new named files, supply both `--output prepared.json --gaps gaps.json`. Existing outputs and input-file replacements are refused. An optional `--records pending.json` prepares a separate snapshot using the same explicit mappings; unmapped recipes appear as gaps rather than acquiring inferred food matches. The checked-in `data/recipes/calculated-pending.json` is the deterministic one-recipe demonstration output.

Each mapping binds recipe ID/version, servings, ingredient index, exact expected name/canonical ID/amount/unit, food code, source dataset version/workbook SHA256, measured food state and mapping reference. Stale bindings fail the affected recipe. Allergy taxonomy IDs do not identify nutrition foods: several different foods share a taxon. A changed approved recipe requires a separately created pending successor; preparation refuses approved or rejected inputs.

The pinned CoFID 2021 slice contains seven exact source rows and their literal cells, codes, names, basis, references and attribution. Source workbook SHA256 is `436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d`; extraction notes and the stdlib reproduction script are in `.planning/mvp-reset/phases/02-catalogue-and-nutrition/source-data/`. Source-data attribution is separate from recipe usage rights. Olive-oil protein is `Tr` and remains trace/null; unknown/trace nutrients cannot enter strict four-number calculations. No missing value is converted to zero.

The pending demonstrator measures raw wholegrain brown rice, raw baby spinach and canned re-heated drained chickpeas. Food state is ingredient-specific and must match the source. Its two-serving batch totals are 745.6 kcal, 37.06g protein, 132.22g carbohydrate and 11.46g fat; per serving rounds to 373 kcal, 19g protein, 66g carbohydrate and 6g fat. These are a reproducible ingredient-input sum, not laboratory results or measured nutrient-retention/cooking-yield findings. The method uses raw rice input grams, not cooked rice grams. The real method, timing, food mapping, allergy/cross-contact evidence and rights still require review. This single pending bowl does not establish weekly catalogue coverage.

## Batch, serving and portion contract

`ingredients.amount` is the entire batch. The calculator converts each measured quantity to its exact food-source basis, sums the batch, then divides by positive recipe servings once. Calculation evidence retains six-decimal line/batch values; per-serving recipe macros round once to whole units under `ingredient-v1`. The planner divides batch ingredients by recipe servings, then applies the accepted individual portion once. Household materialization belongs downstream and must not be repeated in ingredient ledgers.

Exact dimensional conversions support kg/g and l/ml. Volume-to-mass requires explicit density; count-to-mass requires the exact named count-unit weight; spoon measures require explicit measured ml and, when needed, density. Each conversion needs an evidence reference. No generic egg size, tablespoon gram weight, density or raw/cooked conversion is assumed.

## Review and persistence

New approvals require `ingredient_calculated_v1` with complete source snapshots and matching recomputed calculation/macros. Historical attested approved records remain readable as legacy records; they are not reclassified as calculated. Editing recipe ingredients, servings, source evidence or quantities requires a new pending version with recalculation. Existing approved snapshots remain immutable for saved-plan validation.

First validate the pending snapshot without writes:

```powershell
node scripts/import-recipe-library.cjs data/recipes/calculated-pending.json
```

Persist only through the authenticated audited pending-import endpoint. Supply `OVONA_RECIPE_IMPORT_ENDPOINT` with the intended application's complete `/api/recipe-import` URL and `OVONA_RECIPE_IMPORT_TOKEN` with an authorised reviewer's access token in the invoking process environment, then run the same command with `--apply`. HTTPS is required except for explicit loopback HTTP; endpoint credentials, queries, fragments and redirects are rejected. Do not put the token in a JSON file, source control or command argument. The server verifies identity/role and atomically stores 1–50 pending records with importer attribution and audit evidence; one conflict rejects the whole batch. Test this against the isolated app before a separately authorised hosted rollout.

Do not repoint database environment variables or use unaudited direct table writes. A file-only preparation actor is not persisted as a reviewer. Import requires the tested pending-import migration/RPC on the intended database; missing schema produces an explicit failure.

Use `/review-recipes` as an authorised reviewer to check the pending record and all five attestations: source, rights, ingredients, nutrition and cooked method/timing. The atomic workflow creates a new immutable approved version with reviewer attribution and linked import evidence; it does not mutate approved content. `node scripts/review-recipe-library.cjs recipe.reviewed.json` remains a validation-only check. Its `--apply` approval shortcut is disabled; actual approval uses the authenticated review endpoint and transaction.

Every ingredient must match the exact allergy taxonomy, with declared allergens, supplier cross-contact/mayContain evidence and dietary flags reviewed independently of the nutrient source. Empty draft allergen arrays are unverified draft information. The [Food Standards Agency allergen guidance](https://www.food.gov.uk/business-guidance/allergen-guidance-for-food-businesses) is referenced by the existing taxonomy workflow. Never fabricate a cook-through, rights confirmation or evidence boolean to increase catalogue counts.

## Measure actual catalogue readiness

```powershell
node scripts/catalogue-coverage.ts --input data/recipes/calculated-pending.json
```

Coverage reports distinguish calculated and legacy-compatible reviewed admission, pending/rejected/invalid records, slot capacity, actual deterministic scheduling and named cohort failures. A prepared pending recipe remains excluded until genuinely reviewed. Recipe counts alone do not prove macro feasibility, practical portions or repeat-policy capacity. Inspect the current coverage cohort file/report to see exactly which target/diet/allergy/prep profiles were tested; no universal coverage is implied.

Allergies, never-foods, dietary restrictions and prep limits remain hard. Dislikes are soft ranking preferences. Existing per-meal low-carb (30g carbohydrate maximum) and high-protein (20g protein minimum) rules still apply. The current broad plant protein daily cap can prevent full vegan schedules; report it honestly rather than relabelling plants as mixed protein.

Database migrations and permission tests run only on an explicitly guarded fresh disposable target. Applying tested changes to the user's hosted project is a separate rollout step. Keep service credentials out of browsers and exported JSON. This phase does not deploy or start plan/shopping revision work.
