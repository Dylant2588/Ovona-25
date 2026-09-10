---
phase: 07-build-deterministic-personal-meal-orchestration-engine
plan: 03
subsystem: deterministic-planner-core
tags: [typescript, node-test-runner, immutable-replacement, shopping-aggregation]
requires:
  - phase: 07-02
    provides: validated seven-day schedules and materialized household servings
provides:
  - immutable one-slot replacement with hard eligibility and week validation
  - canonical buy/pantry shopping lines scaled once from selected servings
affects: [07-04, 07-05, planner-swap-route, shopping-list-route]
tech-stack:
  added: []
  patterns: [score-derived replacement explanation, non-target identity preservation, canonical ingredient-unit aggregation]
key-files:
  created:
    - frontend-new/lib/orchestration/replace.ts
    - frontend-new/lib/orchestration/shopping.ts
    - frontend-new/tests/orchestration/replace.test.ts
    - frontend-new/tests/orchestration/shopping.test.ts
  modified: []
key-decisions:
  - Replacements reject any validation result that would modify a non-target scheduled meal.
  - Shopping consumes only SelectedMeal.servings and never receives a household-size input.
metrics:
  duration: 15 min
  completed: 2026-09-10
---

# Phase 07 Plan 03: Immutable Meal Replacement and Canonical Shopping Summary

Delivered a deterministic one-slot swap and seven-day shopping materialization that preserves validated meal state and applies household scaling exactly once.

## Tasks Completed

1. Added red/green coverage and `replaceMeal`, which filters and ranks only safe same-slot alternatives, excludes the old candidate, preserves every non-target meal identity, and returns reason-coded failures when replacement cannot remain valid.
2. Added red/green coverage and `buildOrchestrationShoppingList`, which merges canonical ingredient-and-unit lines over all seven days, keeps meal provenance, and separates pantry staples from buy items.

## Task Commits

1. **Task 1 — replacement**: `0ef7467` (RED), `bc31df7` (GREEN).
2. **Task 2 — shopping**: `26588aa` (RED), `6cdff27` (GREEN).

## Verification

- `npm run test:orchestration -- tests/orchestration/replace.test.ts tests/orchestration/shopping.test.ts` — passed: 17 tests, 0 failures.
- `npm run lint` — passed with 0 errors; 7 pre-existing warnings in `app/meals/page.tsx` and `lib/INTEGRATION.ts`.

## Decisions Made

- A swap never silently lets the nutrition-repair pass adjust another existing slot; that case is surfaced as `replacement_validation_failed`.
- Shopping quantities are computed as verified per-recipe-serving ingredient quantity times already materialized `selected.servings`; no profile or household multiplier enters the aggregator.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- All four planned source/test files exist.
- RED and GREEN commits `0ef7467`, `bc31df7`, `26588aa`, and `6cdff27` exist in git history.
