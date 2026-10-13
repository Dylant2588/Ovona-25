---
phase: quick
plan: 261012-qjm
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [PLAN-01, PLAN-03, NUTR-02, D-02, D-04, D-11]
files_modified:
  - frontend-new/supabase/migrations/20261012_recipe_library.sql
  - frontend-new/lib/recipes/types.ts
  - frontend-new/lib/recipes/repository.ts
  - frontend-new/lib/recipes/approval.ts
  - frontend-new/scripts/export-recipe-library.cjs
  - frontend-new/lib/meal-generator.ts
  - frontend-new/lib/orchestration/candidate-adapter.ts
  - frontend-new/lib/generation/generate-plan.ts
  - frontend-new/lib/generation/meal-storage.ts
  - frontend-new/app/api/meal-plan/route.ts
  - frontend-new/app/api/meal-plan/generate/route.ts
  - frontend-new/app/api/meal-plan/generate/day/route.ts
  - frontend-new/app/api/meal-plan/swap/route.ts
  - frontend-new/app/api/meal-plan/state/route.ts
  - frontend-new/app/meals/page.tsx
  - frontend-new/tests/orchestration/recipe-library.test.ts
  - frontend-new/tests/orchestration/meal-approval.test.ts
  - frontend-new/tests/orchestration/meal-approval-integration.test.ts
must_haves:
  truths:
    - Recipe records retain measured ingredients, methods, servings, nutrition, provenance and explicit review status.
    - Unreviewed recipes and unknown ingredient or allergen evidence cannot receive automatic approval.
    - Generation, swaps, regeneration and client-state persistence reject conflicting meals using server-owned preferences.
    - Catalogue or schema unavailability produces an honest unavailable response rather than synthetic certified meals or a client fallback.
  artifacts:
    - path: frontend-new/lib/recipes/approval.ts
      provides: Shared fail-closed approval results
    - path: frontend-new/supabase/migrations/20261012_recipe_library.sql
      provides: Structured recipe library with restricted write privileges
    - path: frontend-new/tests/orchestration/meal-approval-integration.test.ts
      provides: Route and persistence boundary regression checks
  key_links:
    - from: frontend-new/lib/orchestration/candidate-adapter.ts
      to: frontend-new/lib/recipes/repository.ts
      via: Reviewed database recipe loading
    - from: frontend-new/app/api/meal-plan/state/route.ts
      to: frontend-new/lib/recipes/approval.ts
      via: Approval before destructive replacement or insertion
---

<objective>
Introduce an honestly sourced structured recipe library and mandatory preference/allergy approval before meals reach plans or storage. This is the authorized first slice; AI selection, external licensed sourcing, retailer comparison, social meals and desktop spacing remain outside this task.
</objective>

<execution_context>
@C:/Users/u1434/.codex/get-shit-done/workflows/execute-plan.md
@C:/Users/u1434/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@frontend-new/lib/meal-generator.ts
@frontend-new/lib/orchestration/candidate-adapter.ts
@frontend-new/lib/generation/validation-gate.ts
@frontend-new/lib/generation/meal-storage.ts
@frontend-new/app/api/meal-plan/state/route.ts

Current safety gaps: candidate-adapter materializes synthetic verified-catalogue meals; validation-gate accepts approximate ingredient matches and nutrition baselines as evidence; static concept seeding marks recipes verified; route fallback and frontend catch branches can bypass server checks. State POST replaces persisted rows supplied by clients. Meal generation aliases swap POST. Preserve all existing uncommitted macro-enforcement, meal-generator, regression-harness and planning edits; isolate this task's commits.

<interfaces>
Existing MealInstance includes baseId, mealSlot, title, steps/recipeSteps, baseIngredients/ingredients, baseMacros/macros and portionMultiplier. PreferencesInput.profile includes allergies, dislikes and dietaryMode. Existing deterministic builder accepts options.supabase/preferences/context and returns an ok/error union. New shared contracts must use approval status, stable recipe ID/version and structured rejection reasons; never trust a client-supplied approved boolean or tags.
</interfaces>
</context>

<tasks>
<task type="auto" tdd="true">
  <name>Task 1: Define structured recipe records, server repository and honest catalogue export</name>
  <files>frontend-new/lib/recipes/types.ts, frontend-new/lib/recipes/repository.ts, frontend-new/supabase/migrations/20261012_recipe_library.sql, frontend-new/scripts/export-recipe-library.cjs, frontend-new/lib/meal-generator.ts, frontend-new/lib/generation/meal-storage.ts, frontend-new/tests/orchestration/recipe-library.test.ts</files>
  <behavior>Measured quantities and units, servings, methods, source and nutrition evidence survive round trips. Pending seeds are never returned as approved. Missing table or invalid row returns explicit unavailable/rejected state. Unauthenticated clients cannot modify review status.</behavior>
  <action>Define explicit recipe and ingredient evidence contracts before consumers. Create additive idempotent Supabase migration for structured recipes with stable IDs/version, ingredient quantities and units, servings, method, times, slot/dietary tags, nutrition provenance, image path, source kind/reference/rights metadata and pending_review/approved/rejected status plus review metadata. Enforce finite positive measurements and complete approval evidence in application validation; restrict write privileges/RLS to server administration, allow only needed read access. Export the entire static catalogue deterministically, not randomly generated weeks, as internal pending_review records with honest estimated nutrition provenance. No automatic certification or invented external source. Seed/import preserves existing approved records and supports dry-run without secrets in output. Stop seedMealConceptsFromStaticLibrary from setting verified:true. Repository rejects malformed records and schema absence without alternate certified sources. Write migration readiness instructions; attempt deployment only via an available authorized connection and report if SQL execution is unavailable.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/recipe-library.test.ts</automated></verify>
  <done>Schema and typed repository exist, internal seeds retain honest pending review status, export is deterministic and deployment state is documented.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement one fail-closed meal approval gate and candidate admission</name>
  <files>frontend-new/lib/recipes/approval.ts, frontend-new/lib/orchestration/candidate-adapter.ts, frontend-new/lib/generation/generate-plan.ts, frontend-new/tests/orchestration/meal-approval.test.ts</files>
  <behavior>Allergen aliases and dietary conflicts reject. Dislikes never relax. Unknown ingredient or unreviewed/absent allergen evidence rejects even if nutrition is known. Unknown user restriction rejects instead of silently disappearing. An ingredient substitution invalidates prior approval. Approved measured recipes can be scaled safely without changing identity or inventing method/nutrition.</behavior>
  <action>Implement deterministic approve/reject results with reason codes, recipe ID/version and policy version. Canonicalize recognized allergy/dietary aliases conservatively; use explicit reviewed ingredient metadata and known taxonomy, never substring database matches or absence of regex hits as proof of safety. Apply hard dislikes and dietary rules and practical prep constraints. Revalidate actual final ingredients against recipe identity/version; forbid ingredient additions/substitutions without reviewed replacement evidence. Replace production synthetic verified-catalogue materialization with repository-approved candidates admitted through this gate, retaining measured recipe instructions, real protein classification and source metadata in generated MealInstance. Keep synthetic recipes strictly test fixtures. Apply the same gate after any repair/substitution/portion mutation and before returning artifacts. Return structured insufficient/unavailable catalogue results when no reviewed meals exist; do not certify existing recipes to keep generation green.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/meal-approval.test.ts tests/orchestration/recipe-library.test.ts</automated></verify>
  <done>All runtime candidates are reviewed, checked against actual user restrictions and carry reconstructible provenance; rejected meals have actionable reason codes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Enforce approval at every route and persistence boundary and remove UI bypasses</name>
  <files>frontend-new/app/api/meal-plan/route.ts, frontend-new/app/api/meal-plan/generate/route.ts, frontend-new/app/api/meal-plan/generate/day/route.ts, frontend-new/app/api/meal-plan/swap/route.ts, frontend-new/app/api/meal-plan/state/route.ts, frontend-new/app/meals/page.tsx, frontend-new/tests/orchestration/meal-approval-integration.test.ts</files>
  <behavior>Unsafe candidates are never returned as approved or written. State POST with a forged approval, changed ingredient, another user's recipe/plan identity or outdated restrictions fails before delete/insert/history writes. Primary errors cannot bypass approval through server or client fallback. Successful reviewed generation, day regeneration, swap and meal alias pass checks. Legacy saved plans display unchecked status or are withheld.</behavior>
  <action>Inventory POST generation, legacy meal-plan POST, swap, day regeneration, meal-regeneration alias and state persistence. Load authenticated user constraints on the server; client preference payloads cannot weaken persisted allergies/dietary constraints. Resolve recipe IDs against repository and gate each final meal before success or any history/state writes; return consistent 422 meal_approval_failed/insufficient_reviewed_catalogue reason payloads or explicit schema unavailable errors. Validate the complete submitted plan before state route's delete/replace, retaining previous data on rejection. Client tags and approval flags are informational only. Preserve planned swaps and portion behavior only when final checked records match reviewed evidence. Remove page's local generation/regeneration/preference-change fallback branches and missing-response substitutes; retain existing safe plan and display calm actionable failure/readiness text. Mark legacy loaded plans unchecked instead of conflating macro range with ingredient approval. No external source selection, AI expansion or desktop redesign. Use integration doubles recording mutations and invoke actual route/service boundaries, not only pure predicates or regex source tests. Verify approved fixture success and blocked malicious/missing-evidence cases. Run full existing suite and scoped lint, compare TypeScript failures against baseline. Record actual migration deployment readiness and pending review implications.</action>
  <verify><automated>cd frontend-new; npm run test:orchestration</automated></verify>
  <done>No server route or client recovery path bypasses approval; rejected requests leave persisted plans intact; UI honestly explains library readiness and regression suite passes.</done>
</task>
</tasks>

<threat_model>
| Boundary | Threat | Disposition | Mitigation |
|---|---|---|---|
| Client to state/generation API | Forged approvals and weakened restrictions | mitigate | Server preference loading, repository lookup and final gate before writes |
| Database recipes to planner | Pending or malformed evidence certified | mitigate | Explicit reviewed record admission and fail-closed schema errors |
| Recipe mutation to persistence | Substitution retains stale approval | mitigate | Compare actual ingredients/version and rerun gate |
| Client to database | Recipe review privilege escalation | mitigate | Recipe RLS and restricted server-only writes |
</threat_model>

<verification>Full orchestration suite, route mutation-spy integration cases, scoped lint and honest local UI readiness. Replace adapter tests asserting 28 synthetic audited records with explicit approved database fixtures; no runtime synthetic certification. Provide an operator workflow to import pending records, review ingredient/allergen/nutrition/source evidence and update review metadata through server administration; no user approval endpoint or automated approval. Recompute trusted nutrition from approved measured recipe portions instead of client macros. Preference-read errors fail closed. In persistPlan, check the state response and structured rejection before localStorage caching; denied saves leave the old cached/server plan intact. All cached and server legacy plans share unchecked labeling. Baseline TypeScript has 52 existing errors; avoid adding failures or broad cleanup. No API keys in output. Existing uncommitted changes preserved.</verification>
<success_criteria>Structured recipes are available through a restricted Supabase repository; internal seeds remain pending review; all generation and persistence paths enforce the shared gate; schema/review unavailability is surfaced honestly without unsafe fallbacks.</success_criteria>
<output>Create .planning/quick/261012-qjm-build-structured-recipe-library-and-mand/261012-qjm-SUMMARY.md with tests, commits, deployment status and review/source follow-up.</output>
