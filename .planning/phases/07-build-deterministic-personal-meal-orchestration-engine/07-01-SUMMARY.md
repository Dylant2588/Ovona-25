---
phase: 07-build-deterministic-personal-meal-orchestration-engine
plan: 01
subsystem: deterministic-planner-boundary
tags: [node-test-runner, typescript, profile-normalization, candidate-safety]
requires: []
provides: [deterministic-test-harness, canonical-planner-profile, verified-candidate-admission]
affects: [07-02, 07-03, 07-04, 07-05]
tech-stack:
  added: []
  patterns: [Node built-in test runner, pure boundary normalization, reason-coded hard-constraint filtering]
key-files:
  created:
    - frontend-new/lib/orchestration/types.ts
    - frontend-new/lib/orchestration/policy.ts
    - frontend-new/lib/orchestration/normalize-profile.ts
    - frontend-new/lib/orchestration/eligibility.ts
    - frontend-new/tests/orchestration/fixtures.ts
    - frontend-new/tests/orchestration/fixtures.test.ts
    - frontend-new/tests/orchestration/normalize-profile.test.ts
    - frontend-new/tests/orchestration/eligibility.test.ts
  modified:
    - frontend-new/package.json
key-decisions:
  - Node 24's built-in TypeScript stripping powers the dependency-free deterministic tests.
  - Candidate safety facts must be explicit verified metadata; no ingredient or diet inference occurs in the pure core.
requirements-completed: [D-01, D-02, D-03, D-10, D-12]
duration: 12 min
completed: 2026-09-10
---

# Phase 07 Plan 01: Deterministic Planner Safety Boundary Summary

Established a dependency-free Node test harness plus immutable profile normalization and verified-candidate filtering, preventing incomplete or unsafe candidate data from reaching deterministic scheduling.

## Tasks Completed

1. Added `test:orchestration`, static meal/profile fixtures, and a fixture discovery smoke test.
2. Defined canonical planner contracts and centralized policy defaults; profile normalization freezes canonical values and rejects invalid hard constraints with a typed 400-mappable error.
3. Added verified candidate admission, allergy/diet/prep hard filtering, reason-coded exclusions, and typed empty-pool insufficiency results.

## Verification

- `npm run test:orchestration` — passed: 7 tests, 0 failures.
- `npm run lint` — passed with 0 errors; 7 pre-existing warnings in `app/meals/page.tsx` and `lib/INTEGRATION.ts`.

## Decisions Made

- The orchestration test suite uses Node's native TypeScript stripping and test runner, with no new package dependency.
- Planner profile canonicalization treats hard safety values as validation failures, never silently clamps them.
- Candidate admission requires explicit verification and complete normalized nutrition, ingredient quantity, allergen, dietary, cost, and preparation metadata.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 - Blocking] Resolve local TypeScript modules in the Node test runtime**
   - **Found during:** Task 2
   - **Issue:** Node's native TypeScript runtime could execute `.ts` tests but could not resolve extensionless local ESM imports.
   - **Fix:** Used explicit `.ts` specifiers within the new pure orchestration modules.
   - **Files modified:** `frontend-new/lib/orchestration/policy.ts`, `frontend-new/lib/orchestration/normalize-profile.ts`, `frontend-new/lib/orchestration/eligibility.ts`
   - **Verification:** `npm run test:orchestration -- tests/orchestration/normalize-profile.test.ts`
   - **Commit:** b048a06

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** Keeps the planned dependency-free harness executable without affecting production route imports.

## Known Stubs

None.

## Self-Check: PASSED

- All nine planned implementation, fixture, and test files exist.
- Task commits verified: `4790e45`, `799c1f8`, `b048a06`, `4ba011c`, and `3013459`.
