---
status: resolved
trigger: "No safe, macro-feasible day 5 can be built from the reviewed catalogue."
created: 2026-10-28
updated: 2026-10-28
---

## Current Focus
hypothesis: Confirmed freshness-exclusion defect reproduced with the sole account's actual saved targets and history; the full hard-eligible pool resolves that rejection without changing constraints.
test: New regression failed before correction and passes after it. Authenticated local browser generation against edited source succeeded and saved the checked plan; all seven days and five meals are shown.
expecting: Seven valid days at five meals each for the reported account; unsafe/infeasible inputs still refuse.
next_action: Scoped recency repair is complete. General cross-day backtracking and the nine pre-existing suite failures remain separate follow-up work.

## Symptoms
expected: A safe checked seven-day meal plan for the active user's saved constraints.
actual: Generation fails on day 5, labelled quick minimal.
errors: No safe, macro-feasible day 5 can be built from the reviewed catalogue. Review more recipes for that meal type, or choose a longer preparation limit. Your existing plan is unchanged.
reproduction: Generate from authenticated localhost:3000/meals using current preferences.
started: Reported during local testing on 2026-10-28; prior success unknown.

## Eliminated

## Evidence

- checked: Complete schedule.ts, policy.ts, practical-ingredients.ts, score.ts and validate.ts.
  found: selectDay backtracks within one day only; orchestrateWeek commits each day and never revisits earlier days. A null result after maximum recipe uses 2 then 3 is always reported as insufficient_candidates, regardless of whether nutrition, repetition or cumulative practical constraints blocked search. The route suggests prep/catalogue fixes without proving those causes.
  implication: The message does not prove that a safe seven-day solution is absent or that increasing prep time fixes it.
- checked: Pure synthetic scheduling fixture with five snack recipes, four recipes each for breakfast/lunch/dinner, five slots/day, 2000 kcal and 120g protein; no allergies/history/practical protein ingredients.
  found: Current scheduler fails day7. A constructive snack pairing witness [0,1],[2,3],[4,0],[1,2],[3,4],[0,2],[1,3] combined with the other selected meals passes validateAndRepairWeek. Every recipe is used at most three times, each day has two distinct snacks and at most two meals of one protein type, and all portions/macros/practical limits remain valid. Six snack recipes make current scheduler succeed.
  implication: Confirmed cross-day greedy false negative independent of live user data. The scarcity fallback already allows three weekly uses; the witness does not relax it.
- checked: Read-only SELECT of approved recipe_library rows; no user records or live writes. Applied browser-reported Mixed, Dairy/Nuts/Fish/Shellfish/Sesame restrictions and 30-minute limit via actual approveRecipe().
  found: 38 approved rows, 23 eligible. Two approved records fail unknown-ingredient taxonomy; two exceed prep time; others fail allergies/evidence. Examples eligible include pea-oat/shake breakfasts/snacks, egg-white dishes, chicken/turkey snacks, chicken dishes, tofu dishes and smoky-bean-pea bowl.
  implication: Approved count is not equivalent to effective catalogue count. Exact active targets/history were not obtained by this agent.
- checked: Actual eligible catalogue with hypothetical 1830 kcal/216g protein/five slots and no recent history; eight deterministic AI priority permutations.
  found: No-history schedule succeeds; all eight priority permutations succeed. Other hypothetical profiles 2000/160 and 2000/120 fail days4 and1 respectively.
  implication: Old debug targets alone do not establish the active-session failure. Feasibility depends on actual targets and history.
- checked: Same eligible catalogue, same hypothetical 1830/216 targets, synthetic recentSimilarityKeys equal to first eight admitted IDs: apple-cinnamon-pea-oats, berry-pea-protein-oats, chicken-crunch-snack-box, chicken-pepper-skewers, chicken-tomato-pasta, chicken-vegetable-soup, cocoa-banana-pea-pot, egg-white-oat-pancakes.
  found: Exact reported day5 insufficient_candidates message reproduces. Changing only the scheduler expression fresh.length ? fresh : pool to pool in an in-memory transpiled copy makes the same inputs produce a validated seven-day schedule. No source files changed; no AI calls performed.
  implication: Confirmed freshness admission defect: when any fresh candidate remains, all recent candidates are removed even if fresh candidates cannot complete a valid day/week. Recency is described as ranking guidance but is implemented as exclusion.
- checked: Parent read-only verification after user authorised checking the sole account, 2026-10-28.
  found: Exactly one account; actual saved targets 1830 kcal, 216g protein, 118g carbs, 55g fat, five meals and 30-minute preparation limit. Actual buildContext/adapter/history replay fails day5; in-memory pool correction succeeds seven days at five meals each with unchanged gates. No AI calls or database writes.
  implication: Exact-session attribution is now confirmed rather than hypothetical.
- checked: Test-first implementation of recent-safe-meal regression, 2026-10-28.
  found: New test failed before source edit (0/1) and passed after. It verifies seven days, calorie/protein bands, safe portion bounds and refusal when recent breakfast options have a prohibited allergen.
  implication: Regression demonstrates the actual exclusion mechanism and protects hard safety admission.
- checked: Local regression checks after minimal source correction, 2026-10-28.
  found: Schedule/eligibility/shopping/AI proposal tests 18/18 passed. Targeted ESLint emitted no errors; nonincremental TypeScript exited 0 with no diagnostics. Full orchestration suite 65 tests, 56 passed and the same nine previously audited failures (approval dislike expectation, legacy fallback, two replacement fixtures, migration history-state expectation and four validation fixtures); zero new failures.
  implication: Minimal fix has focused passing coverage; existing baseline failures remain outside this repair. Parent still needs saved-input replay/UI confirmation after source edit.

## Resolution
root_cause: selectDay excludes all recent candidates whenever any fresh candidate exists, even when fresh candidates cannot satisfy daily targets. Parent reproduced exact day5 rejection with the sole user's saved inputs and proved the full eligible pool succeeds. Cross-day greedy exhaustion is a separate known limitation, not changed by this repair.
fix: Rank the complete hard-eligible pool, preserving existing scoring and all allergy, diet, preparation, portion, repetition and practical-quantity guards. Remove unused fresh-filter/helper code; make the un-reassigned running binding const to keep touched-file lint clean. No schema, preference, database or dependency changes.
verification: RED-before/GREEN-after regression; 18/18 adjacent tests; targeted lint clean; TypeScript clean. Full suite 56/65 with same nine baseline failures. Actual authenticated localhost generation succeeded through approval and persistence; UI reports reviewed macros within target range, seven day selectors, five meals and shopping summary of 25 items. Friday, the previously blocked fifth day, displays 1975 kcal and 220g protein with five meals at preparation times no greater than 30 minutes. Screenshot: .planning/debug/reviewed-day-five-fixed.png. Browser test intentionally created the user's new checked plan; no preferences or schemas changed.
files_changed: [frontend-new/lib/orchestration/schedule.ts, frontend-new/tests/orchestration/schedule.test.ts]

## Suggested repair and regression coverage

Preserve allergy/diet/prep/portion/macro/practical limits. Treat recency as a score penalty or search fresh candidates first and then admit reviewed recent candidates if fresh-only search fails. Add bounded week-level backtracking or lookahead/reservation for repeated slots so earlier decisions can be revisited, with explicit search-budget/timeout errors distinct from proven catalogue insufficiency. Surface whether candidate coverage, repetitions, practical caps, nutrition intersection or search budget blocked generation; do not automatically instruct users to increase prep time.

Regression 1: the 23-admitted catalogue shape and synthetic eight-ID recent history yields seven valid days with unchanged hard constraints. Regression 2: a tiny fresh candidate that cannot satisfy nutrition does not exclude a recent valid candidate. Regression 3: five snack recipes for fourteen slots, max3 uses and distinct daily pairs succeeds using a valid schedule witness. Regression 4: genuinely insufficient or hard-unsafe catalogue still returns explicit refusal with no persistence. Exact active-session replay needs macro targets, meal count and recent history; do not substitute a first database user.
