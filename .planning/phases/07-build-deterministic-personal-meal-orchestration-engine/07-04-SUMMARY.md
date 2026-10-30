---
phase: 07-build-deterministic-personal-meal-orchestration-engine
plan: 04
subsystem: deterministic-generation-adapter
tags: [typescript, deterministic-scheduling, verified-catalogue, seven-day]
requires:
  - phase: 07-03
    provides: pure scheduling and shopping contracts
provides:
  - provenance-bearing verified candidate catalogue
  - seven-day deterministic generation compatibility adapter
affects: [07-05, meal-plan-routes, shopping-list-routes]
tech-stack:
  added: []
  patterns: [server-side candidate hydration, explicit verified provenance, typed catalogue insufficiency]
key-files:
  created:
    - frontend-new/lib/orchestration/verified-catalogue.ts
    - frontend-new/lib/orchestration/candidate-adapter.ts
    - frontend-new/tests/orchestration/generation-adapter.test.ts
  modified:
    - frontend-new/lib/generation/generate-plan.ts
    - frontend-new/lib/generation/nutritionist.ts
    - frontend-new/lib/meal-generator.ts
    - frontend-new/scripts/fallback-regression-test.cjs
key-decisions:
  - Only immutable curated facts with source/version provenance can enter deterministic scheduling.
  - Incomplete or LLM-originated concepts remain untrusted and cannot relax a catalogue shortage.
  - WORKDAY_COUNT remains the legacy API symbol but now represents seven days.
requirements-completed: [D-01, D-02, D-04, D-05, D-06, D-07, D-09, D-10, D-12]
duration: 25 min
completed: 2026-09-10
---

# Phase 07 Plan 04: Deterministic Generation Adapter Summary

Connected route-facing weekly generation to a provenance-complete deterministic seven-day schedule, with typed failure when verified capacity is insufficient.

## Tasks Completed

1. Added a literal, immutable curated catalogue with explicit nutrition, ingredient quantity/unit, allergens, dietary metadata, prep, cost, verification, and source/version provenance. The adapter normalizes server context, proves seven-day slot capacity before scheduling, and rejects shortages as `INSUFFICIENT_VERIFIED_CATALOGUE`.
2. Replaced the active generation entry point’s final selection with the deterministic core and materialized its seven dated days into the established plan/artifact shapes. Legacy generation constants, prompt cardinalities, and fallback plan consumers now use `WORKDAY_COUNT = 7`.

## Verification

- `npm run test:orchestration -- tests/orchestration/generation-adapter.test.ts` — passed: 19 tests.
- `node scripts/fallback-regression-test.cjs` — passed.
- `npm run lint` — passed with 20 warnings (existing app/integration warnings plus unused legacy generation helpers now bypassed by the deterministic adapter); no errors.

## Task Commits

1. `888c2b9` — test(07-04): add failing verified catalogue adapter tests.
2. `c141be6` — feat(07-04): hydrate deterministic planning from verified catalogue.
3. `884e057` — feat(07-04): route generation through deterministic seven-day core.
4. `7b292fd` — fix(07-04): preserve populated compatibility artifacts.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Updated the fallback regression’s stale five-day assertion**
   - **Found during:** Task 2
   - **Issue:** The regression script hard-coded five days, contradicting the newly required `WORKDAY_COUNT = 7` and causing the planned verification to fail.
   - **Fix:** Assert against the exported compatibility invariant rather than a literal day count.
   - **Files modified:** `frontend-new/scripts/fallback-regression-test.cjs`
   - **Verification:** `node scripts/fallback-regression-test.cjs`
   - **Commit:** `884e057`

2. **[Rule 2 - Missing Critical] Returned populated compatibility artifacts from deterministic selections**
   - **Found during:** Task 2
   - **Issue:** Returning an empty `practical.adjustedPlan` would leave existing artifact consumers without materialized meals despite a successful deterministic schedule.
   - **Fix:** Materialized the selected verified meals and a verified-selection cost into the compatibility artifact.
   - **Files modified:** `frontend-new/lib/generation/generate-plan.ts`
   - **Verification:** deterministic tests, fallback regression, and lint.
   - **Commit:** `7b292fd`

**Total deviations:** 2 auto-fixed. **Impact:** The seven-day invariant is asserted by the regression harness and downstream artifacts remain populated without invoking untrusted selection paths.

## Known Stubs

None.

## Self-Check: PASSED

- All six planned source/test artifacts exist.
- Task commits `888c2b9`, `c141be6`, `884e057`, and `7b292fd` exist in git history.
