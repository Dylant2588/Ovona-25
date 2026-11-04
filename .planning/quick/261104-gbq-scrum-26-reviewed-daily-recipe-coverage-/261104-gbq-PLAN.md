---
phase: quick-261104-gbq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend-new/lib/recipes/catalogue-coverage.ts
  - frontend-new/scripts/catalogue-coverage.ts
  - frontend-new/tests/orchestration/catalogue-coverage.test.ts
  - .planning/quick/261104-gbq-scrum-26-reviewed-daily-recipe-coverage-/261104-gbq-COVERAGE.md
autonomous: true
requirements: [SCRUM-26]
must_haves:
  truths:
    - Daily coverage is tested by the existing real scheduler with the same hard restrictions and portion rules as generation.
    - Hard turkey exclusion and soft turkey avoidance are distinct diagnostic inputs.
    - The confirmed owner cohort and balanced cohort have a constructive daily result or an accurately classified unresolved gap.
    - Reviewed legacy compatibility is never described as ingredient-calculated nutritional readiness.
  artifacts:
    - path: frontend-new/lib/recipes/catalogue-coverage.ts
      provides: Scope-aware dietary cohort feasibility using shared recipe approval and scheduling
    - path: .planning/quick/261104-gbq-scrum-26-reviewed-daily-recipe-coverage-/261104-gbq-COVERAGE.md
      provides: Fresh read-only catalogue evidence and explicit coverage gaps
  key_links:
    - from: frontend-new/lib/recipes/catalogue-coverage.ts
      to: frontend-new/lib/orchestration/schedule.ts
      via: orchestrateWeek with explicit day/week scope
    - from: frontend-new/lib/recipes/catalogue-coverage.ts
      to: frontend-new/lib/recipes/approval.ts
      via: approveRecipe with all cohort hard restrictions
---

<objective>
Deliver SCRUM-26 by measuring and proving reviewed daily recipe coverage, reusing existing content whenever it already satisfies the agreed individual-user cohorts. Extend the existing file-only diagnostic rather than building another planner or validation engine. No catalogue writes, new dependency, schema change, automatic AI recipe creation, deployment or merge.
</objective>

<context>
@AGENTS.md
@.planning/STATE.md
@frontend-new/lib/recipes/catalogue-coverage.ts
@frontend-new/scripts/catalogue-coverage.ts
@frontend-new/tests/orchestration/catalogue-coverage.test.ts
@frontend-new/lib/plan-scope.ts
@frontend-new/lib/recipes/repository.ts
@frontend-new/lib/recipes/approval.ts
@.planning/mvp-reset/phases/02-catalogue-and-nutrition/02-CATALOGUE-READINESS.md

Discovery Level 0: reuse internal APIs; no new integration. Existing diagnostic assumes a week and its CoverageCohort lacks neverFoods/dislikes. Its restrictive default omits the owner's current egg allergy and turkey exclusion. The Oct29 report observed 38 hosted approved recipes, all legacy-attested, with zero calculated versions. Checked-in 02-existing-pending.json and calculated-pending.json are pending; they are not approved coverage. Refresh the hosted evidence, not its approval flags.

The owner cohort was read from the live preferences UI on Nov4 without edits: mixed diet; Dairy, Nuts, Fish, Shellfish, Eggs and Sesame allergies; never egg and turkey; soft avoid turkey; 30-minute limit; all cuisine options. Live daily target display was 1830 kcal /216g protein with five slots (breakfast, snack, lunch, snack, dinner). SCRUM-25 generated a checked legacy-compatible day at 1976 kcal/232g protein, then a swapped/reloaded day at 1918/219. Recipe examples: Vanilla Berry Pea Protein Shake or Apple Cinnamon Pea Protein Oats, Cocoa Banana Pea Protein Pot, Herbed Chicken Rice Plate, Chicken & Cucumber Snack Box, Tofu Noodle Stir-Fry. This is a constructive current compatibility witness, not proof of calculated-source nutrition or universal coverage.

Interfaces: parsePlanScope(value) defaults missing to week; planDayCount(scope) returns1/7; orchestrateWeek(profile,candidates,history={},scope="week"). Existing approveRecipe takes RecipeConstraints including allergies, dietaryModes, neverFoods and dislikes. DEFAULT_COVERAGE_COHORTS weekly behaviour and existing CLI file-only policy must remain supported. Baseline216 tests, TypeScript passes, lint9 warnings. Preserve unrelated dirty shopping UI and all source/approved recipe versions.
</context>

<tasks>
<task type="auto" tdd="true">
  <name>Task 1: Extend the existing coverage diagnostic for complete daily cohorts</name>
  <files>frontend-new/lib/recipes/catalogue-coverage.ts, frontend-new/scripts/catalogue-coverage.ts, frontend-new/tests/orchestration/catalogue-coverage.test.ts</files>
  <behavior>Explicit daily scope can be feasible with a catalogue insufficient for a week. Omitted scope remains weekly. Hard turkey exclusion removes recipes; soft avoidance does not exclude them. Counts alone cannot establish feasibility, pending drafts cannot count, malformed approved rows fail closed, and bounded search remains indeterminate rather than proven infeasible.</behavior>
  <action>Write regressions first. Add optional scope, neverFoods and dislikes to CoverageCohort, validate them strictly with existing scope helpers and bounded string arrays, and pass all restrictions to shared approveRecipe/recipesToCandidates/profile construction. Pass the selected scope to orchestrateWeek. Include selected scope/dayCount and periodDemand in output; retain existing dailyDemand/weeklyDemand fields with their literal meanings for compatibility. Keep weekly defaults and existing seven default cohorts unchanged unless a separate explicit daily cohort file is supplied. Daily diagnostics should invoke the production scheduler's bounded search rather than stop solely at the existing estimated weekly-combination guard; retain a documented bounded execution and accurately classify budget exhaustion. Preserve separate legacyCompatible/calculatedOnly results, exact slot demand including two snacks, unknown evidence and malformed-approved-library failure. Do not claim a failed bounded run is a mathematical impossibility. Add fixture tests for daily versus weekly, complete five-slot owner-shaped restrictions, hard versus soft turkey handling, unsupported/impossible cohort, exactly-once portions and CLI deterministic output/input immutability. Synthetic reviewed/calculated fixtures test logic only and must stay labelled synthetic; they cannot certify hosted readiness.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/catalogue-coverage.test.ts tests/orchestration/daily-planning.test.ts</automated></verify>
  <done>Existing and new tests prove scope-aware diagnostics use the real shared planner and distinguish safety, soft preferences, search limits and evidence quality without weakening weekly behaviour.</done>
</task>

<task type="auto">
  <name>Task 2: Prove fresh hosted catalogue coverage and record the actual remaining gaps</name>
  <files>.planning/quick/261104-gbq-scrum-26-reviewed-daily-recipe-coverage-/261104-gbq-COVERAGE.md</files>
  <action>Read only the configured project's approved recipe_library records using the existing server credentials/client (never print credentials, query user tables or mutate data). Select id/version/review_status/record, paginate explicitly if needed, validate the snapshot through loadReviewedRecipes-equivalent identity checks, and record retrieval timestamp, record count and SHA256. Keep raw snapshots containing review attribution out of commits; commit a redacted aggregate report and recipe/version witness information, not user IDs or secrets. Feed the unchanged records into the file-only CLI with explicit daily cohorts: balanced mixed three slots at2000kcal/150g/30min; the confirmed owner five-slot1830/216/allergies/neveregg+turkey cohort; the same restricted case with turkey only soft-avoided (keep egg exclusion), plus a clearly impossible diagnostic fixture covered automatically. Report eligible recipes per slot, rejection codes, actual scheduled meal/version/portion totals and legacyCompatible versus calculatedOnly separately. Verify selected daily recipe ingredients contain no excluded turkey or allergens via shared approval, macro bands, and ingredient quantities divided/scaled exactly once. If these agreed successful cohorts are covered, add no unnecessary recipes. If they genuinely lack coverage, name the precise missing slot/evidence and do not fabricate approval or silently relax targets; prepare any necessary successor recipe only through the existing review workflow, and accurately retain unmet acceptance until real approval exists. Preserve immutable approved versions. The report must state source calculations remain unavailable where all eligible recipes are legacy-attested and must not call this calculated nutritional completeness. Cross-reference SCRUM-25 live witness and SCRUM-27 evidence work. Run full tests, TypeScript and lint; record every failure/warning and remaining unsupported cohort rather than claiming universal support.</action>
  <verify><automated>cd frontend-new; npm run test:orchestration; npx tsc --noEmit --incremental false; npm run lint</automated></verify>
  <done>Fresh read-only evidence establishes a practical complete day for each agreed supported cohort, with reproducible diagnostics and exact remaining limitations. No new recipe is added when existing reviewed content suffices; no pending/legacy evidence is misrepresented. All test results and unmet criteria are explicit before Jira Review.</done>
</task>
</tasks>

<threat_model>
| Boundary | Threat | Disposition | Mitigation |
|---|---|---|---|
| Cohort input to diagnostic | Missing hard exclusions or normalised invalid inputs creates false coverage | mitigate | Strict scope/constraint validation and shared recipe approval |
| Catalogue snapshot to readiness report | Pending or legacy records represented as calculated/reviewed coverage | mitigate | Preserve source status, structural checks and split legacy/calculated probes |
| Hosted read to report/commit | Credential or reviewer identity disclosure | mitigate | Read approved recipe fields only; no secret output; raw snapshot excluded from commits |
</threat_model>

<verification>
Decision/AC coverage: scope/prep/target assessment Task1+2; confirmed owner and hard/soft turkey cases Task1+2; exact gaps and existing reuse Task2; new versions only if necessary and authentically reviewed Task2; supported full-day constructive witnesses Task2; deterministic fixtures/unsafe failure and serving arithmetic Task1. No locked decision is reduced. Source-calculated coverage may remain an explicit content limitation; do not mark an unmet criterion verified.
</verification>

<success_criteria>
The existing diagnostic measures one-day readiness with actual restrictions. Fresh approved catalogue evidence and a constructive day establish supported compatibility cohorts. Missing calculated evidence, unsupported cohorts and search limits remain explicit. No fabricated approvals, duplicate engines, live data writes, dependency/schema changes or unrelated edits occur.
</success_criteria>

<output>
Create .planning/quick/261104-gbq-scrum-26-reviewed-daily-recipe-coverage-/261104-gbq-SUMMARY.md with outcomes, tests and acceptance gaps. Parent owns STATE, Jira and docs commit.
</output>
