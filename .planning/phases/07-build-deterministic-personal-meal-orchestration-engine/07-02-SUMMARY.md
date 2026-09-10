---
phase: 07-build-deterministic-personal-meal-orchestration-engine
plan: 02
subsystem: deterministic-planner-core
tags: [typescript, node-test-runner, deterministic-scheduling, nutrition-validation]
requires:
  - phase: 07-01
    provides: canonical profiles, policy defaults, and verified candidate admission
provides:
  - stable seven-day scheduling with inspectable numeric candidate scores
  - bounded immutable daily nutrition validation and portion repair
  - single-pass household serving materialization for downstream shopping
affects: [07-03, 07-04, 07-05, planner-routes, shopping-aggregation]
tech-stack:
  added: []
  patterns: [pure deterministic ranking, fact-derived explanations, reason-coded validation failures]
key-files:
  created:
    - frontend-new/lib/orchestration/score.ts
    - frontend-new/lib/orchestration/schedule.ts
    - frontend-new/lib/orchestration/validate.ts
    - frontend-new/tests/orchestration/schedule.test.ts
    - frontend-new/tests/orchestration/validate.test.ts
  modified:
    - frontend-new/lib/orchestration/types.ts
key-decisions:
  - Candidate ties resolve by candidate ID after named finite score components.
  - Nutrition repair adjusts only individual portion multipliers before applying household scaling once.
patterns-established:
  - Keep hard eligibility filtering ahead of ranking and retain candidates during repair rather than introducing substitutions.
  - Return reason-coded invalid plans instead of relaxing daily nutrition or repeat constraints.
requirements-completed: [D-03, D-04, D-05, D-06, D-07, D-09, D-10, D-12]
duration: 6 min
completed: 2026-09-10
---

# Phase 07 Plan 02: Deterministic Weekly Scheduling and Validation Summary

**Pure seven-day meal scheduling with stable scoring, repeat-safe leftovers, bounded nutrition repair, and single-pass household servings.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-10T10:07:48Z
- **Completed:** 2026-09-10T10:13:41Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- Added finite, named score components and candidate-ID tie-breaking for deterministic weekly selection.
- Scheduled exactly seven required-slot days after verified eligibility filtering, with explicit similarity and declared-leftover handling.
- Validated every day against inclusive calorie/protein bands; bounded repair modifies individual portions only and returns reason-coded invalidity when it cannot succeed.
- Materialized `recipeServings * nutritionPortionMultiplier * householdPortionMultiplier` once for downstream aggregation.

## Task Commits

1. **Task 1: Score and schedule a stable seven-day set with practical reuse and repetition rules** — `ca62f2c` (RED), `4b4e4ae` (GREEN).
2. **Task 2: Validate and bounded-repair daily nutrition without weakening hard constraints** — `48dafd4` (RED), `63ebe73` (GREEN).

## Verification

- `npm run test:orchestration -- tests/orchestration/validate.test.ts tests/orchestration/schedule.test.ts` — passed: 13 tests, 0 failures.
- `npm run lint` — passed with 0 errors and 7 existing warnings outside this plan's files.

## Files Created/Modified

- `frontend-new/lib/orchestration/types.ts` — canonical score, selected-meal, serving, and validation-report contracts.
- `frontend-new/lib/orchestration/score.ts` — deterministic numeric components and stable ranking.
- `frontend-new/lib/orchestration/schedule.ts` — pure bounded seven-day scheduling and factual explanations.
- `frontend-new/lib/orchestration/validate.ts` — immutable band validation and bounded individual-portion repair.
- `frontend-new/tests/orchestration/schedule.test.ts` — determinism, slot, tie-break, repeat, leftover, and explanation coverage.
- `frontend-new/tests/orchestration/validate.test.ts` — seven-day bands, invalidity, repair bounds, and household materialization coverage.

## Decisions Made

- Candidate ranking is deterministic by construction: finite numeric components, descending totals, then `candidate.id.localeCompare`.
- Repair never substitutes a new candidate: it preserves previously hard-filtered/repeat-safe selections and changes only their individual nutrition multipliers within fixed bounds.
- Household size is applied only while materializing returned servings, never to the individual nutrition arithmetic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The restricted shell could not spawn Node test workers (`EPERM`); the same local test command completed successfully with the required execution permission.

## Known Stubs

None.

## Next Phase Readiness

- The pure scheduler returns only validated seven-day plans or a serializable invalidity report, ready for swap and shopping adapters.
- No blockers.

## Self-Check: PASSED

- All six planned source/test files and this summary exist.
- RED and GREEN commits `ca62f2c`, `4b4e4ae`, `48dafd4`, and `63ebe73` exist in git history.
