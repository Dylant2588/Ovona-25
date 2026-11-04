---
phase: quick-261104-nb2
plan: 01
subsystem: nutrition
tags: [daily-mvp, micronutrients, evidence, approval]
requires: [SCRUM-25, SCRUM-26]
provides: [optional-source-micronutrients, approved-nutrition-projection]
affects: [SCRUM-30]
tech-stack:
  added: []
  patterns: [shared-quantity-conversion, exact-version-display-mappings, authenticated-read-only-projection]
key-files:
  created: [frontend-new/lib/recipes/plan-nutrition.ts, frontend-new/app/api/meal-plan/nutrition/route.ts]
  modified: [frontend-new/lib/recipes/types.ts, frontend-new/lib/recipes/nutrition.ts]
completed: 2026-11-04
---

# SCRUM-27: Evidence-aware daily nutrition

Optional calcium, iron and vitamin C calculations reuse existing food-source validation and exact quantity conversion; the authenticated nutrition projection preserves reviewed macro totals and explicitly distinguishes unknown, partial and estimated nutrient evidence.

## Completed core tasks

1. Added optional milligram nutrient fields to existing food snapshots and `calculateRecipeMicronutrients` in the existing nutrition module. Numeric zero remains known; null, missing, trace/non-numeric, invalid source, incompatible preparation state and conversion failures remain unknown. Batch-to-serving division and selected meal multiplier apply exactly once. The immutable ingredient-v1 macro calculation payload is unchanged.
2. Added `buildPlanNutritionSummary` in `plan-nutrition.ts` and POST `/api/meal-plan/nutrition`. The route authorises the user and uses saved restrictions plus one reviewed-recipe snapshot through the existing real approval boundary before projection. No client nutrient facts become trusted evidence. The route has no database-write path.

The parent owns curated CoFID snapshots/exact sidecar mappings and the UI. Sidecars match recipe ID, version, ingredient index, exact name and canonical ID. Embedded evidence takes precedence; ambiguous or invalid evidence never falls through to a guessed mapping. Display estimates do not replace reviewed macros or re-attest immutable recipes.

## Evidence model

- Per nutrient: `unknown`, `partial` or `complete`, known/total ingredient contributions, known subtotal, complete amount only when every contribution is known, source identities and an estimate flag.
- Social-meal exceptions prevent a complete-day claim and keep macro evidence unknown.
- Macro evidence: ingredient-calculated, legacy-reviewed, mixed or unknown; the current hosted catalogue remains legacy-reviewed.
- Adult food-labelling reference amounts are informational, not personalised clinical goals: calcium 800 mg, iron 14 mg, vitamin C 80 mg, with the authoritative Annex XIII source link carried in every nutrient row.

## Verification

- New targeted arithmetic/summary/API tests: six passed.
- Full combined suite at core completion: 227 passed, zero failed or skipped; local HTTP access enabled for the existing redirect test.
- TypeScript noEmit: passed.
- ESLint: zero errors and nine existing warnings.
- Final finite-precision guard regression: two summary tests passed again after its small follow-up.
- Actual route tests exercise the real approval boundary and reject forged owner, quantities, unknown versions and current saved exclusions; authentication and missing-body cases are covered. Fixture database exposes reads only, so writes cannot silently pass.
- Swapped versions invalidate sidecars; reload preserves summaries; serving/unit conversions, null/zero distinctions, partial coverage, authoritative precedence and source failures are covered.

Parent records final browser and UI verification below before Jira Review.

## Commits

- `447be66`: failing micronutrient arithmetic specification.
- `e5a27f8`: shared optional nutrient calculation and existing evidence compatibility.
- `19a2633`: failing recipe summary specification.
- `88bb350`: failing authenticated projection specification.
- `3669999`: approved exact-portion projection and API.
- `c17a93f`: finite quantization regression guard.

## Deviations and limitations

- Naming aligned with the orchestrator: `plan-nutrition.ts` instead of the plan's illustrative `nutrition-summary.ts`, and parent-curated `display-nutrition-mappings.ts` instead of `display-nutrition-data.ts`. The responsibilities and contracts are unchanged.
- Existing medical-engine zero-fill and condition-derived targets were deliberately not used because they cannot establish known nutrient evidence. No replacement medical engine was introduced.
- No approved source-calculated recipes currently exist. Source estimates cover only curated raw ingredients; unsupported ingredients and full-day adequacy remain unknown. This is an explicit evidence limitation rather than a fabricated nutrition total.
- No schema/dependency changes, live data mutation, merge or deployment.

## Known Stubs

None added. Unknown/partial values are deliberate evidence states with a real approved-recipe data path, not empty placeholders. Missing authoritative catalogue mappings remain visible.

## Threat Flags

No additional surface beyond the plan's authenticated read-only nutrition endpoint. Existing server approval, saved constraints and immutable recipe identities protect the projection.

## Self-Check: PASSED (core tasks)

Created source and regression files exist; all six listed commits are in Git history. Parent completes Task 3 UI, browser evidence, final metadata commit and Jira transition.

## Final UI and live verification
- UI/data commit730a4f1 adds exact-version CoFID display mappings, four macro goals, legacy/source confidence and micronutrient unknown/partial/zero presentation. Original approved macros and recipe records remain unchanged.
- Full final suite227passed0failed0skipped; TypeScript passed; ESLint0errors9existingwarnings. Presentation test checks unknown versus measured zero and partial totals with layout wrappers; real MUI verified in browser.
- Live saved owner day displays1918kcal/219gprotein/139gcarbs/60gfat and goals1830/216/118/55. Two of24ingredient contributions mapped: calcium24.7mg,iron0.5mg,vitaminC11.9mg known subtotals; complete-day totals explicitly unknown. Source links visible. Screenshotnutrition-proof.png.
- Current limited source mappings cannot establish micronutrient adequacy. Generic adult labelling references are not personalised clinical targets. SOURCE-NOTES.md documents official CoFID extraction, exact raw-method bindings and references.
- Local browser500 traced to a cloud-only installed MUI file and stopped OneDrive provider. Starting OneDrive was rejected by automatic approval review because of broad synchronization risk; no cloud sync was started. Restored only the unreadable file from an already-local identical7.3.5package copy, cleared generatedNextdevcache and restarted localserver3000. No dependencies installed or changed in the lockfile.
- No schema/live recipe changes, merge or deployment. Ready for owner review with evidence limitations above.
