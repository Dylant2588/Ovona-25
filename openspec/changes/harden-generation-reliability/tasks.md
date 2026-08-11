## 1. Nutrition-data baseline

- [ ] 1.1 Inventory every ingredient reachable from static fallback meals and identify missing, duplicate, alias-only, or zero-nutrition ingredient records.
- [ ] 1.2 Add a version-controlled seed/compatibility migration for verified nutrition records and normalized aliases needed by the fallback library.
- [x] 1.3 Update ingredient lookup to resolve normalized aliases deterministically and distinguish missing nutrition data from a valid zero-valued field.
- [ ] 1.4 Add unit-level coverage proving all fallback meal ingredients resolve to positive macro data.

## 2. Nutrition acceptance and target validation

- [x] 2.1 Add a final meal acceptance check that rejects all-zero or incomplete meal macros before a plan is returned.
- [x] 2.2 Add safe replacement/recovery behavior for concepts with unresolved ingredient nutrition, without returning misleading zero-macro meals.
- [ ] 2.3 Validate final daily totals against calorie and protein targets and preserve per-day enforcement results for the planner.
- [ ] 2.4 Update planner empty/error states and macro visualization to render only accepted plan totals.

## 3. Preference and allergy integrity

- [x] 3.1 Reconcile request preferences with authenticated persisted preferences under a documented precedence order before creating generation context.
- [x] 3.2 Read and normalize every supported allergy source, including `user_allergies.allergy_name`.
- [x] 3.3 Apply allergy-family expansion to generated concepts, fallback meals, alternatives, and swaps.
- [x] 3.4 Make final safety validation fail closed: replace unsafe meals with validated safe options or return an explicit incomplete-plan result.
- [ ] 3.5 Add regression coverage for a Dairy allergy excluding Greek yoghurt/yogurt and related dairy ingredients.

## 4. Generation diagnostics and verification

- [ ] 4.1 Return/record plan provenance and validation outcomes for AI, fallback, and replacement meal sources.
- [ ] 4.2 Add request-level tests for custom macro targets, preference changes, allergy violations, and unresolved ingredients.
- [ ] 4.3 Execute the production dogfood smoke test: save Dairy allergy and custom targets, generate once, verify non-zero meal/chart totals, reload without regeneration, and verify no dairy suggestions.
