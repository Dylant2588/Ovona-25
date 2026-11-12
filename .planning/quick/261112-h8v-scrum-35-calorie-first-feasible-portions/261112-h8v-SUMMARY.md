---
phase: quick-261112-h8v
plan: 01
subsystem: meal-orchestration
tags: [calories, portions, bounded-search, regression]
requires:
  - phase: daily-mvp
    provides: Reviewed recipe admission, daily scope, immutable revisions and exact ingredient ledger
provides:
  - Calorie-directed feasible portions and complete-plan incumbent selection
  - Target-only replacement portions with immutable surrounding meals
affects: [SCRUM-30, SCRUM-36, SCRUM-37]
tech-stack:
  added: []
  patterns: [bounded convex projection, verified complete-plan incumbent]
key-files:
  created: []
  modified:
    - frontend-new/lib/orchestration/portions.ts
    - frontend-new/lib/orchestration/schedule.ts
    - frontend-new/lib/orchestration/replace.ts
    - frontend-new/lib/orchestration/practical-ingredients.ts
    - frontend-new/tests/orchestration/portions.test.ts
    - frontend-new/tests/orchestration/schedule.test.ts
    - frontend-new/tests/orchestration/replace.test.ts
    - frontend-new/tests/orchestration/generation-fallback.test.ts
key-decisions:
  - Keep existing calorie/protein bands and all hard safety/practical constraints unchanged
  - Establish a complete feasible incumbent before optional calorie improvement
  - Bound optional improvement to 2000 nodes and 250ms within the existing overall budget
  - Compare summed daily calorie deviations, never net weekly calorie differences
requirements-completed: [SCRUM-35]
completed: 2026-11-12
---

# SCRUM-35: calorie-directed safe portions and complete-plan selection

**The planner now aims at calorie targets and retains the closest verified complete schedule it evaluates, instead of accepting unscaled in-band portions by default.** Engineering implementation and automated verification are complete; parent owns the Jira Review decision. No merge, push, deployment or live database write.

## Delivered

- Reused the existing half-space portion projection, conservative knapsack feasibility bounds and practical ingredient limits. The solver tries the calorie target, preserves a verified full-band fallback, then makes at most 12 tighter objective probes. Six-decimal portions and nearby rounding-threshold adjustments are checked against original continuous and individually rounded calorie/protein bands. Optional fixed bounds support immutable surrounding portions.
- Shared scaling now aims at calorieTarget/baseCalories. Scheduling first finds a complete feasible plan using existing traversal and then considers improvements. A verified complete incumbent is ranked by sum of normalised absolute daily rounded calorie errors, then soft score and stable identity. Partial/dead-end searches and cutoffs cannot replace it.
- Original feasibility limits remain 150000 nodes/5000ms. Optional improvement uses no more than 2000 remaining nodes/250ms inside that deadline. Exact zero-error plans can stop early; soft ties retain traversal order at that lower bound. Test controls only tighten limits and use an injected clock rather than global time mutation.
- Replacement helper evaluates safe alternatives using the same solver with every non-target portion fixed, includes the unchanged week's practical usage, rejects a third same-family meal and checks unaffected objects by position so duplicate snack slots retain distinct identities.
- Actual generation/materialisation/final-approval regression covers day and week at a 1700 kcal target, exact ingredient scaling and unchanged protein bands.

## Acceptance evidence

| Criterion | Evidence | Result |
|---|---|---|
| Improve already in-band portions | portions.test.ts: 1050 to 1000 kcal fixture; independent 800 kcal fixture | Pass, within 1 kcal |
| Calorie objective before soft preference | schedule.test.ts preferred inaccurate candidate versus precise alternative; bounded weekly improvement comparison | Pass |
| No weekly under/over cancellation | calorieDeviationFor used by incumbent comparator; weekly +40/-40 fixture still has .04 error | Pass |
| Exact infeasible retains safe fallback | protein-constrained single-meal fixture returns approximately 1059 rather than abandoning the feasible interval | Pass |
| Deadline/node cutoff preserves complete incumbent | controlled-clock and node tests with/without incumbent, no partial days | Pass |
| Practical limits, restrictions and protein unchanged | existing portion/validator/eligibility/dietary/quantity/variety suites and full regression | Pass |
| Rounded materialisation and approval agree | generation-fallback actual day/week 1700 kcal regression, current plan-state revision tests and final recipe approval | Pass |
| Single replacement preserves surrounding meals | replace.test.ts target-only calorie optimisation, two snack identities, unsafe/repeated candidates and third-family rejection | Pass |
| Hard portion ceiling survives validation | rounding-boundary reproducer rejects a would-be repaired 1.500001 multiplier | Pass |
| Existing plan survives failures | unchanged approval/revision persistence suites; no persistence changes in this task | Pass |

The production swap API currently generates reviewed alternatives through generateWeeklyPlanWithArtifacts, then runs enforceMacros and final approval. It does **not** call the orchestration replaceMeal helper. This task does not rewire that API or claim helper tests prove its entire interactive swap journey. Real generation/approval and existing swap-related regressions pass; SCRUM-30 remains the full journey acceptance task.

## Verification

- Baseline normal orchestration suite: 238 passed. Initial sandbox spawn EPERM was resolved by rerunning with the needed process permissions; no tests were removed or skipped.
- Final normal `npm run test:orchestration` after all source changes: **252 passed, zero failures, zero skipped**, approximately 4.95 seconds.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run lint`: zero errors, nine unchanged existing warnings. Existing module-type/baseline-browser-mapping notices remain; no configuration or dependency changes.
- `git diff --check`: passed.
- Independent GSD safety/code review across all eight changed source/test paths, including final interval-bound optimisation: zero critical, warning or informational findings; see `261112-h8v-REVIEW.md`.
- No browser claims: this is an algorithm change, with controlled generation/approval tests. Existing SCRUM-29 browser acceptance remains outstanding.

## Bounded evidence and limitations

The portion solver is a finite numerical search, not a general exact optimisation engine. Projection non-convergence never proves mathematical infeasibility. The result is the nearest verified point found within the finite probes; the scheduler returns the best verified complete plan it actually evaluated, not a global catalogue optimum. Production wall-clock cutoffs can affect which improvements are explored; controlled-budget fixtures are deterministic.

Parent independently ran one offline historical owner-shaped fixture against the saved 4 November reviewed snapshot after final commit a105bfc: target1830 kcal/216g protein, five slots and the previously confirmed restrictions produced **1937 kcal/212g protein**, compared with the earlier 1976 kcal/215g baseline. That is 39 kcal closer, with a remaining **+107 kcal (about5.85%)** deviation. This is one bounded snapshot run, not current account/live plan evidence or a guarantee of the same output on every machine. Both baseline and result use legacy-attested recipe macros, not newly source-calculated nutrition. Combined normal/excluded offline probes took about289ms in that parent run.

Adding tofu and pea protein exclusions still leaves that cohort infeasible; restrictions were not relaxed. Catalogue coverage is SCRUM-36, not solved by this objective change.

## Commits and RED/GREEN evidence

| Scope | RED | Implementation |
|---|---|---|
| Portion objectives/fixed bounds | c9ea338 (four expected failures) | ed16a42 |
| Scheduler objective/cutoffs | 6c9cfe4 (three expected failures) | ec84c03 |
| Rounding-boundary hard ceiling | 9e4e57a | b796d5c |
| Target-only replacements | 0565307 (two expected failures) | 6b7dcb3, including real generation approval regression |
| Short improvement allocation | 9be9d50 | c51f4fc |
| Impossible projection work bound | c426f51 | a105bfc |

## Deviations and review fixes

- Reused remainingPortionLimits with an ingredient-only structural input type so existing selected meals can be fixed without unsafe candidate casts or fabricated verified flags.
- Added a safety-review regression/fix: shared rounded nutrition could previously trigger a tiny validator repair above1.5. Shared continuous checks and final incumbent bounds now reject that path. The validator's admission semantics and policy bands were not rewritten.
- A pre-existing rounded-boundary fixture spent the full5s improvement budget. The plan explicitly allowed a narrower allocation; optional improvement is now limited to250ms/2000nodes. Conservative existing bounds also reject impossible narrowed/margin intervals before projection. The work-bound fixture improved from5600 to740 projection checks; the initial arbitrary test threshold300 was calibrated to1000, without altering any product acceptance condition.
- Corrected the plan's nonexistent plan-revisions.test.ts reference to plan-state-revisions.test.ts and included actual generation tests. No unrelated files were staged.

## Known Stubs / Threat Flags

None. No new endpoint, authentication path, file-access surface or schema boundary was introduced. Null results are deliberate fail-closed solver outcomes, not placeholders.

## Jira handoff draft

SCRUM-35 implementation is committed on codex/scrum-35-calorie-objective. Reuses the existing portion solver and bounded scheduler to prioritise daily calorie proximity while preserving protein, hard dietary exclusions, practical quantities and portion/repetition bounds. Complete incumbents survive deadline/node cutoffs. Actual day/week generation and final recipe approval are covered. 252 tests pass with zero failures/skips; TypeScript passes; lint0errors/9existingwarnings; independent review has no findings. A historical snapshot example improved1976→1937kcal against1830target, still107kcalabove; no exact-all-plans guarantee. New tofu/pea exclusions still need SCRUM-36 catalogue work. No merge/deploy/live database change. Parent may move to Review with these limits; humans close tickets.

## Self-Check: PASSED

All eight changed application/test files, PLAN and REVIEW exist. All listed RED/GREEN commits were verified in Git history. Existing dirty SCRUM-28 summary and private untracked artefacts are untouched. Parent root owns STATE and Jira updates.
