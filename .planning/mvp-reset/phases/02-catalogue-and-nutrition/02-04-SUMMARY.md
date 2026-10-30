---
phase: 02-catalogue-and-nutrition
plan: 04
status: software_verified_content_review_pending
updated: 2026-10-29
requirements: [CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06]
---

# Plan 04 — sourced pending preparation

Task 1 and the recipe operations documentation are implemented. Parent orchestration owns final full-suite, disposable database/browser checks and catalogue-readiness/verification reports; this summary does not substitute for those gates.

Parent integration completed: final 147/147 regression and 11/11 actual disposable database checks passed; TypeScript/lint/quantity and browser import/review checks passed. See `02-VERIFICATION.md`. Genuine reviewed calculated catalogue coverage remains outstanding; preparation is not approval.

## Delivered

- `scripts/prepare-recipe-nutrition.ts`: pure exported preparation function and file-only CLI; no environment loading, database clients, network or approval writes. Exact mappings bind ID/version, servings, index, expected name/canonical ID/amount/unit, food code/version/SHA256 and state. Stale/missing/duplicate mappings and incomplete numeric source evidence produce per-recipe gaps.
- `data/nutrition/cofid-2021-slice.json`: seven actual official CoFID 2021 rows retaining literal source cells, references, code, units/state and attribution. Olive-oil protein remains trace/null, never zero.
- `data/recipes/nutrition-mappings.json`: explicit original pending rice/spinach/chickpea bowl and precise source mappings. No existing catalogue draft was silently mapped by taxonomy.
- `data/recipes/calculated-pending.json`: one reproducible pending two-serving recipe with ingredient-source snapshots, line/batch/serving calculation and all review flags false/null attribution.
- `tests/orchestration/nutrition-preparation.test.ts`: deterministic official-source arithmetic and output equality; no input mutation; stale bindings/state/hash, unknown/trace, duplicate/missing mapping, approved-input refusal, review clearing and file overwrite guards.
- `lib/recipes/REVIEW.md`: current calculation/legacy transition, preparation/import commands, source limits, pending review workflow and readiness distinction. Removed stale instructions for direct approval writes and hard-dislike semantics.

The actual bowl batch computes to 745.6 kcal, 37.06g protein, 132.22g carbohydrate and 11.46g fat. Dividing once by two and rounding under `ingredient-v1` yields 373 kcal / 19g protein / 66g carbohydrate / 6g fat per serving. Its verified existing image asset is `/images/meals/bowl.svg`.

## Executed checks

1. TDD red: new preparation test failed with missing implementation module before implementation.
2. `node --test tests/orchestration/nutrition-preparation.test.ts tests/orchestration/recipe-nutrition.test.ts`: **11 passed, 0 failed, 0 skipped** after implementation and image correction; repeated successfully after resuming the interrupted session.
3. `npx tsc --noEmit --incremental false`: **exit 0**, no diagnostics; final resumed check also completed successfully.
4. Preparation CLI wrote the initial pending JSON and `.planning/mvp-reset/phases/02-catalogue-and-nutrition/02-PREPARATION-GAPS.json` (**empty array** for this explicitly mapped one-recipe input). Subsequent tests prove the checked-in output equals fresh in-memory preparation.
5. `node scripts/import-recipe-library.cjs data/recipes/calculated-pending.json`: **exit 0**, one valid pending record, no database write or importer attribution created.

6. `npx eslint scripts/prepare-recipe-nutrition.ts tests/orchestration/nutrition-preparation.test.ts`: **exit 0**, zero lint errors/warnings. The installed baseline-browser-mapping package emits its existing age notice; no package update was installed.

Full integration verification remains parent-owned.

## Content limits

The bowl remains pending. Rights, exact product/state mappings, supplier allergens/cross-contact, cooking method and preparation time have not been independently verified or cook-tested. Source calculation is an ingredient-input sum, not laboratory or measured cooking-retention/yield evidence. The 38 existing exported pending drafts lack complete exact mappings; this demonstrator does not establish reviewed weekly coverage or support every diet/target/prep profile. No hosted data was changed and Phase 3 was not started.
