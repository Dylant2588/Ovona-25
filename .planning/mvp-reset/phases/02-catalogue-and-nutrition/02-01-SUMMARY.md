---
phase: 02-catalogue-and-nutrition
plan: 01
status: verified_locally
subsystem: nutrition
tags: [typescript, units, nutrition, provenance]
requires: [01-trustworthy-baseline]
provides: [precise-food-snapshots, dimensional-quantity-conversion, deterministic-ingredient-nutrition]
affects: [02-02, 02-03, 02-04]
tech-stack:
  added: []
  patterns: [pure-offline-calculation, explicit-source-snapshots]
key-files:
  created:
    - frontend-new/lib/recipes/quantities.ts
    - frontend-new/lib/recipes/nutrition.ts
    - frontend-new/tests/orchestration/recipe-nutrition.test.ts
    - frontend-new/tests/orchestration/calculated-recipe-fixtures.ts
  modified: [frontend-new/lib/recipes/types.ts]
key-decisions:
  - Nutrition food identities and preparation states are separate from allergy taxonomy.
  - No density, count weight or spoon volume is assumed without referenced evidence.
  - Persist six-decimal batch/line values and whole-number per-serving macros, preserving full source snapshots in the recipe.
requirements-completed: [CAT-01, CAT-02]
completed: 2026-10-29
---

# Phase 2 Plan 01: Reproducible ingredient nutrition

**Measured batch quantities now reproduce source-based batch and per-serving nutrition using explicit versioned food snapshots and evidence-backed conversions.**

## Tasks completed

1. Extended recipe types additively and implemented `convertIngredientQuantity` with exact mass/volume normalization, referenced density and named count/spoon conversions. Supplied conversion fields are validated even when unused. Unknown units, mismatched preparation state, malformed evidence and nonfinite amounts fail closed.
2. Implemented `calculateRecipeNutrition`, `calculatedNutritionErrors` and `newApprovalNutritionErrors`. Source metadata and all four nutrients are required, trace/missing is never zero, ingredients sum before serving division, nonfinite arithmetic fails and stale/tampered stored calculations are rejected. Legacy evidence is readable without being relabelled calculated; new approvals need the calculated method.

Core imports only types and quantity arithmetic, avoiding repository/approval cycles. No network, database, environment loading or writes occur in the calculator. Inputs are not mutated. `calculatedRecipe()`/`syntheticFood()` are explicitly synthetic test fixtures, not real food evidence.

## Verification

- RED: `node --test tests/orchestration/recipe-nutrition.test.ts` failed as expected because the calculator module did not yet exist.
- GREEN: same command **6 tests pass, zero failures/skips**. Tests cover hand-computed two-ingredient/two-serving totals, direct mass/volume and explicit density/count/spoon conversion, malformed/unknown nutrients and sources, exact cooked-and-drained state, state mismatch, stale quantities/revisions/lines/servings/macros, legacy policy, distinct food IDs under one taxon, overflow, stable fractional calculation and input preservation.
- `npx tsc --noEmit --incremental false`: **pass**.
- Focused ESLint on all five owned files: **pass, zero errors/warnings** (tool emitted its existing baseline-browser-mapping freshness advisory).

CAT-06 integrated full-suite/database evidence belongs to Plan 04, not this focused verification. No application dependencies, database schemas or hosted records changed.

## Commits and deviations

No commits/staging were created, explicitly following parent assignment and this plan's output instruction to preserve the existing mixed working tree. No historical planning/state files were edited. Added a 500-ingredient calculator bound to reject unbounded malformed recipe arrays; ordinary valid recipe inputs remain unaffected. At the parent's request, added explicit `cooked_drained` food state after real source extraction exposed that combined preparation state; it is never coerced to merely drained.

## Known stubs and threat surface

No stubs. Missing evidence intentionally returns actionable errors. These pure modules add no endpoints, credentials, file access, schema or network surface. Human mapping/source/allergy review remains required; self-declared snapshot fields do not establish independent source authenticity.

## Self-Check: PASSED

All five owned source/test files exist, the scoped summary exists, focused tests/TypeScript/ESLint passed, and shared contract readiness was communicated to the parent. Task completion has no commit hashes because commits were explicitly disallowed.
