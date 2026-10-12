---
phase: quick
plan: 261012-pus
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [PLAN-01, PLAN-03, PLAN-04, NUTR-02, SHOP-02]
files_modified:
  - frontend-new/lib/meal-images.ts
  - frontend-new/components/MealThumbnail.tsx
  - frontend-new/public/images/meals/*.svg
  - frontend-new/app/meals/page.tsx
  - frontend-new/lib/meal-generator.ts
  - frontend-new/tests/orchestration/meal-images.test.ts
  - frontend-new/tests/orchestration/meal-variety.test.ts
must_haves:
  truths:
    - Existing and freshly generated meals display consistent illustrated thumbnails.
    - Restricted high-protein plans contain materially different recipes without sacrificing allergen exclusion or target tolerances.
    - Users set a general budget before generation; selecting a retailer is not required.
  artifacts:
    - path: frontend-new/lib/meal-images.ts
      provides: Stable semantic fallback image mapping
    - path: frontend-new/components/MealThumbnail.tsx
      provides: Image rendering with bounded load-error fallback
    - path: frontend-new/tests/orchestration/meal-variety.test.ts
      provides: Restricted-profile variety and target regression
  key_links:
    - from: frontend-new/app/meals/page.tsx
      to: frontend-new/components/MealThumbnail.tsx
      via: Meal row thumbnail
    - from: frontend-new/lib/meal-generator.ts
      to: frontend-new/tests/orchestration/meal-variety.test.ts
      via: Deterministic generation exercised under restrictive preferences
---

<objective>
Add illustrated meal thumbnails and improve real recipe variety while preserving nutrition reliability and the user's budget-first, retailer-recommendation-after-generation concept.
Output: Local illustrated assets, resilient meal image presentation, expanded viable recipes, and focused regressions.
</objective>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@frontend-new/app/meals/page.tsx
@frontend-new/lib/meal-generator.ts
@frontend-new/lib/generation/nutritionist.ts
@frontend-new/lib/tesco-prices.ts

<interfaces>
MealInstance already provides image: string, title: string, mealSlot: MealSlot, baseId: string, ingredients: IngredientLine[], and macros: MacroBreakdown. Use that existing contract. Generation currently includes empty images; historical meals must work without backfill.
New shared contract: export function imageForMeal(meal: { title: string; mealSlot: string; ingredients?: readonly { name: string }[]; image?: string }): string. UI/assets worker owns this helper, component and SVG assets. Generator worker owns meal-generator.ts and variety tests; import the helper after its contract exists. Persist local paths through createMealInstance's existing image property and plan_history plan JSON; no migration is needed.
</interfaces>

Locked decisions: D-01 illustrated thumbnails; D-02 materially varied recipes; D-03 general budget then generate meals then recommend where to shop. Desktop space refinement is deferred.

Coverage: D-01 task 1 Full; D-02 task 2 Full; D-03 task 3 Full preservation and honest current capability assessment. Cross-retailer pricing implementation requires a separate data-backed scope; do not claim it exists.
Preserve all existing uncommitted source changes. Stage only changes belonging to this quick task, and avoid committing unrelated work.
</context>

<tasks>
<task type="auto" tdd="true">
  <name>Task 1: Add semantic illustrated thumbnails with safe fallback</name>
  <files>frontend-new/lib/meal-images.ts, frontend-new/components/MealThumbnail.tsx, frontend-new/public/meal-illustrations/*.svg, frontend-new/app/meals/page.tsx, frontend-new/tests/orchestration/meal-images.test.ts</files>
  <behavior>Missing, blank, and unsuitable legacy photo URLs resolve to consistent local illustrations; semantic dish families receive distinct assets; trusted explicit illustration paths work; a failed source falls back once without a retry loop.</behavior>
  <action>Per D-01 create a small coherent set of code-native SVG illustrations for bowls, eggs/toast, wraps, pasta, soups and snacks, with a neutral generic fallback. Define a pure shared resolver using meal title/slot and ingredients rather than arbitrary rotating pictures. Render an appropriately sized thumbnail in the compact meal rows and recipe presentation, preserving keyboard access and mobile readability. Prefer local illustrations over unrelated legacy Unsplash photos. Validate image sources and do not render user-provided SVG markup. Keep decorative thumbnail alternative text empty when the adjacent title already labels the meal. Existing persisted image strings remain supported via the resolver; no mandatory DB schema change or historical backfill is required. Persist specific artwork through the existing image field only when useful; add a database column only if inspection demonstrates a genuine missing storage contract, and use compatibility-safe reads/writes in that case.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/meal-images.test.ts</automated></verify>
  <done>Every meal row displays a relevant illustrated asset; old empty-image plans work; broken images safely recover; UI remains compact on mobile.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Expand viable recipe choices and enforce meaningful rotation</name>
  <files>frontend-new/lib/meal-generator.ts, frontend-new/tests/orchestration/meal-variety.test.ts</files>
  <behavior>A seven-day 1,830 kcal/216g protein profile excluding dairy, nuts, fish, shellfish and sesame retains all existing target tolerances and excluded-ingredient rules; breakfasts and snacks each have at least three genuinely distinct viable recipes, mains at least four, with no identical breakfast seven days running; swap/regeneration preserves safety and viable macro budgets.</behavior>
  <action>Per D-02 expand the actual deterministic catalogue with usable ingredient combinations and preparation methods that can meet the restrictive profile, including egg/egg-white, lean meat and appropriate plant options where their macro density permits. Compute nutrition from the existing ingredient data; include truthful ingredient quantities, cooking times and executable recipe steps. Distinct titles over identical ingredient/preparation templates do not count as variety. Use existing eligibility and portion/target correction paths rather than weakening thresholds or bypassing allergy filters. Strengthen selection with recipe-family/ingredient/preparation rotation across breakfasts, snacks and mains, while allowing repetition when the safe eligible pool is genuinely too small. Add the restrictive regression plus a less-restricted control profile; verify that increasing variety does not create impossible slots or hidden protein supplements. Keep changes within the existing generation implementation unless tracing proves a further module must change, then document that deviation.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/meal-variety.test.ts</automated></verify>
  <done>Generated restricted weeks pass current nutrition checks and measured meaningful-variety assertions; recipes contain executable steps; exclusions remain enforced.</done>
</task>

<task type="auto">
  <name>Task 3: Verify integrated presentation and document retailer capability honestly</name>
  <files>.planning/quick/261012-pus-add-meal-placeholder-images-and-improve-/261012-pus-SUMMARY.md</files>
  <action>Per D-03 verify that the general-budget input still precedes meal generation and no retailer-selection gate is introduced. Inspect Tesco pricing and shopping aggregation to identify the actual supported retailer/data contracts; document the precise additional data required for future whole-basket retailer recommendations without claiming existing cross-store comparison. Run focused tests and lint changed source files, inspect the signed-in local planner at desktop/mobile sizes, exercise recipe open, day selection and swap, and record evidence. Avoid desktop layout restructuring, deferred OAuth branding, or unsupported best-shop claims. Report any unrelated existing TypeScript failures distinctly. Include the decision coverage matrix and exact changed files in the summary.</action>
  <verify><automated>cd frontend-new; npm run test:orchestration; npx eslint lib/meal-images.ts components/MealThumbnail.tsx lib/meal-generator.ts app/meals/page.tsx tests/orchestration/meal-images.test.ts tests/orchestration/meal-variety.test.ts</automated></verify>
  <done>Integrated meals display illustrations; nutrition/variety checks pass; budget-first flow is retained; summary states supported pricing coverage and verification evidence.</done>
</task>
</tasks>

<threat_model>
Trust boundaries: persisted meal metadata to image rendering; preferences to generation; retailer estimates to user decisions.

| Threat | Category | Disposition | Mitigation |
|---|---|---|---|
| T-Q-01 Untrusted image URLs/markup | T/I | mitigate | Prefer local SVG asset paths; validate sources; never inject SVG markup; bounded error fallback. |
| T-Q-02 Allergy violations through new recipes | T | mitigate | Existing eligibility filters plus ingredient-level restrictive-profile regressions. |
| T-Q-03 Misleading retailer ranking | T | mitigate | Preserve general-budget flow and describe actual Tesco-only coverage; require comparable full-basket data before recommending a best retailer. |
</threat_model>

<verification>Focused image and variety tests, orchestration suite, changed-file lint, and local desktop/mobile interaction inspection.</verification>
<success_criteria>Illustrations work for existing and new meals; variety improves materially under the restrictive target profile; nutrition/allergy protections remain; budget-first product flow remains intact.</success_criteria>
<output>Create 261012-pus-SUMMARY.md in this quick-task directory.</output>
