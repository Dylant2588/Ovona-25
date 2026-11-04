---
phase: quick-261104-dwi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend-new/lib/recipes/taxonomy.ts
  - frontend-new/lib/recipes/approval.ts
  - frontend-new/lib/retailer-comparison.ts
  - frontend-new/lib/retailer-observation-adapters.ts
  - frontend-new/app/api/shopping-list/route.ts
  - frontend-new/tests/orchestration/meal-approval.test.ts
  - frontend-new/tests/orchestration/meal-approval-integration.test.ts
  - frontend-new/tests/orchestration/dietary-generation.test.ts
  - frontend-new/tests/orchestration/retailer-comparison.test.ts
  - frontend-new/tests/orchestration/shopping-route-consistency.test.ts
autonomous: true
requirements: [OV-03]
must_haves:
  truths:
    - Saved restrictions cannot be removed by request input or relaxed by generation.
    - Milk derivatives and egg ingredients cannot pass reviewed recipe approval for conflicting allergies.
    - Shopping projections and retailer pricing cannot imply suitability without current server-side checks.
    - Rejected plans perform no plan or basket writes.
  artifacts:
    - path: frontend-new/lib/recipes/approval.ts
      provides: Shared reviewed recipe dietary approval
    - path: frontend-new/lib/retailer-comparison.ts
      provides: Explicit unsuitable and unverified product evidence handling
  key_links:
    - from: frontend-new/app/api/shopping-list/route.ts
      to: frontend-new/lib/recipes/plan-boundary.ts
      via: approvePlanForUser before ingredient projection
    - from: frontend-new/lib/retailer-comparison.ts
      to: frontend-new/lib/recipes/taxonomy.ts
      via: shared canonical allergen normalization
---

<objective>
Close dietary-safety gaps in existing recipe approval and shopping/retailer boundaries for SCRUM-11. Reuse current ledger, reviewed recipe approval, constraint persistence and deterministic generation. Do not deploy, change schemas, rewrite approved recipes, or include unrelated shopping UI changes in commits.
</objective>

<context>
@AGENTS.md
@.planning/STATE.md
@frontend-new/lib/recipes/taxonomy.ts
@frontend-new/lib/recipes/approval.ts
@frontend-new/lib/recipes/server-constraints.ts
@frontend-new/lib/recipes/plan-boundary.ts
@frontend-new/lib/orchestration/candidate-adapter.ts
@frontend-new/lib/retailer-comparison.ts
@frontend-new/app/api/shopping-list/route.ts

Verified existing behavior: loadServerConstraints unions user_preferences, profiles and user_allergies with request restrictions and fails closed on unreadable data. buildDeterministicPlanningInput admits only approveRecipe-approved reviewed recipes. swap/day generation and state persistence use approvePlanForUser/writeApprovedPlan. Existing tests cover unknown allergy rejection, cross-contact, forged plans, and zero writes on failure. Preferences persistence tests already exist; retain them and add missing restriction-roundtrip cases only if discovery shows a gap.

Partial/missing: taxonomy does not define standalone casein/whey reviewed ingredient aliases; shopping GET/POST validate ingredient shape but bypass reviewed-recipe and saved restriction approval; retailer observations contain price provenance but no dietary/allergen evidence. compareRetailerBaskets can currently qualify price matches with unknown suitability. Extending these existing boundaries is sufficient; do not add an independent policy engine or treat pure candidate labels as stronger evidence than reviewed recipes.

Baseline supplied by orchestrator: sandbox run had 199 tests, 198 passed and one recipe-cli-boundaries.test.ts:51 transport assertion failure. The isolated recipe CLI suite subsequently passed all four tests outside the network sandbox, identifying an environment restriction rather than an application defect. Run the final complete suite outside that restriction; never skip the test or claim a fully green suite without its result.
</context>

<tasks>
<task type="auto" tdd="true">
  <name>Task 1: Strengthen shared ingredient evidence and prove existing generation/persistence safety</name>
  <files>frontend-new/lib/recipes/taxonomy.ts, frontend-new/lib/recipes/approval.ts, frontend-new/tests/orchestration/meal-approval.test.ts, frontend-new/tests/orchestration/meal-approval-integration.test.ts, frontend-new/tests/orchestration/dietary-generation.test.ts</files>
  <behavior>Milk allergy rejects milk, whey and casein even when allergen declarations are omitted; egg allergy rejects egg ingredients; saved never-food restrictions survive client empty overrides and regeneration; no eligible recipes yields a safe actionable failure; manually submitted restricted plans cannot invoke persistence callbacks.</behavior>
  <action>Add tests first using reviewedRecipe and recipeDatabase fixtures. Extend the exact reviewed taxonomy and canonical allergen aliases for well-defined milk derivatives (casein, caseinates, whey) and egg derivatives as supported by reviewed evidence. Preserve canonical IDs of existing recipes. Keep unknown/composite ingredients unapproved without evidence, cross-contact conservative, and dislikes soft. Inspect preference persistence/retrieval tests for all three restriction classes and extend those existing tests if missing. Preserve candidate-adapter's existing approveRecipe admission and swap/state approval wiring; add regression coverage instead of a duplicate engine. If final portions or nested metadata reveal an actual bypass, fix it in approveRecipe/validateMealAgainstRecipe. Do not silently mutate reviewed recipe records.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/meal-approval.test.ts tests/orchestration/meal-approval-integration.test.ts tests/orchestration/dietary-generation.test.ts tests/orchestration/preferences-route.test.ts</automated></verify>
  <done>AC1, AC2, AC3, AC6, AC7 and AC8 have evidence from existing or added tests; restriction rejection happens before writes and request overrides cannot remove saved safety restrictions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Require explicit retailer suitability evidence before ranking restricted baskets</name>
  <files>frontend-new/lib/retailer-comparison.ts, frontend-new/lib/retailer-observation-adapters.ts, frontend-new/tests/orchestration/retailer-comparison.test.ts</files>
  <behavior>Known allergen and dietary conflicts are excluded before price ranking. Missing, unknown or malformed product allergen/suitability evidence is unverified rather than safe. A cheaper unsafe match never beats a suitable verified match. Retailer price provenance alone does not prove dietary safety.</behavior>
  <action>Extend the existing observation contract with optional explicit reviewed product suitability evidence and extend compareRetailerBaskets to accept effective RecipeConstraints without breaking its existing now argument. Reuse canonicalAllergens/normalizeIngredient; define structured conflict/unverified reasons in this module. Validate complete allergen evidence and relevant dietary/exclusion evidence independently of price freshness. Missing evidence must fail closed for dietary-constrained qualification and be explicitly represented as unverified; it must never imply safety for unrestricted users either. Preserve existing price-claim semantics and freshness checks. Keep operator-imported optional evidence through acceptOperatorObservationBatch and reject malformed declared evidence. Do not introduce retailer matching, scraping, new feeds, dependencies or schema migration (OV-08 is separate). Existing database observations without new metadata remain unverified.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/retailer-comparison.test.ts</automated></verify>
  <done>AC4 and AC5 are enforced in the existing comparator with tests for known conflicts, unknown evidence, restricted alternatives and no false safety claims.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire saved restrictions and recipe approval into shopping boundaries and verify regressions</name>
  <files>frontend-new/app/api/shopping-list/route.ts, frontend-new/tests/orchestration/shopping-route-consistency.test.ts</files>
  <behavior>Forged/restricted shopping POST and stale stored meals conflicting with current saved restrictions reject before a basket is returned. Safe reviewed plans still derive exact quantities through buildShoppingList. Product comparison receives authoritative saved restrictions. Rejection changes neither active plan nor basket persistence.</behavior>
  <action>Reuse approvePlanForUser and approvalFailure in both shopping GET and POST before buildShoppingList; retain current owner/date/shape guards and zero-write POST contract. Obtain effective server constraints for retailer evaluation via loadServerConstraints (reuse one loaded snapshot through boundary injection where appropriate rather than inconsistent independent reads). Forward them to compareRetailerBaskets. Parse optional product suitability metadata only if present; avoid selecting new database columns that do not exist across environments, and treat absent evidence as unverified. Update route fixtures with real reviewed recipe boundaries or injected doubles consistent with existing test harness. Preserve UI-facing item/provenance shapes and existing department/Used in work. Run full suite, lint and type checks, report baseline transport failure separately, and do not move ticket to Review unless all eight AC have verified evidence or explicitly report the unmet criterion.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/shopping-route-consistency.test.ts; npm run test:orchestration; npx tsc --noEmit; npm run lint</automated></verify>
  <done>Both shopping endpoints enforce server dietary approval, retailer comparison consumes current restrictions, applicable regressions pass and every remaining failure/risk is recorded.</done>
</task>
</tasks>

<threat_model>
| Boundary | Threat | Disposition | Mitigation |
|---|---|---|---|
| Client plan/preferences to shopping API | Tampered ingredient lists or erased restrictions | mitigate | Existing approvePlanForUser plus loadServerConstraints before projection |
| Retailer evidence to price ranking | Unknown allergens represented as suitable | mitigate | Explicit evidence state; reject conflicts and keep unknown unverified before ranking |
| Generation to persistence | Unsafe replacement overwrites approved plan | mitigate | Existing writeApprovedPlan checked before callback, zero-write regressions |
</threat_model>

<verification>
AC matrix: AC1 Task1; AC2 Task1; AC3 Task1; AC4 Tasks2/3; AC5 Task2; AC6 Task1; AC7 Tasks1/3; AC8 Tasks1/3. No externally supplied medical claims or new medical recommendations are needed. No live-user data mutation is required for tests. Existing known test transport failure must be reproduced/reported without unrelated edits or skips.
</verification>

<success_criteria>
All eight ticket criteria have concrete regression evidence. Shared reviewed-recipe validation remains authoritative. Unknown retailer evidence never produces a suitability claim. Hard restrictions remain intact on generation, swaps, manual submissions and shopping projection. Only this ticket's files are committed, Jira receives accurate test results and remaining risks, and review awaits owner approval.
</success_criteria>

<output>
Create .planning/quick/261104-dwi-scrum-11-ov-03-hard-dietary-restriction-/261104-dwi-SUMMARY.md after execution.
</output>
