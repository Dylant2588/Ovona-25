---
phase: quick-261104-not
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend-new/lib/shopping-provenance.ts
  - frontend-new/components/ShoppingRecipeSources.tsx
  - frontend-new/tests/orchestration/shopping-provenance.test.ts
  - frontend-new/tests/orchestration/daily-shopping.test.ts
  - frontend-new/lib/shopping-departments.ts
  - frontend-new/tests/orchestration/shopping-departments.test.ts
  - frontend-new/app/meals/page.tsx
autonomous: true
requirements: [SCRUM-28]
must_haves:
  truths:
    - The approved day's exact materialized ingredients produce one consolidated shopping requirement per compatible food form and unit.
    - Used-in contributions identify the actual recipe/version and sum to the same ledger total after swaps and reloads.
    - Category grouping and accessible source reveal remain usable without displaying unapproved or stale baskets.
    - Loading, rejected and empty requirements have understandable states outside the hidden basket.
  artifacts:
    - path: frontend-new/lib/shopping-provenance.ts
      provides: Stable reviewed recipe identity for source grouping
    - path: frontend-new/tests/orchestration/daily-shopping.test.ts
      provides: Daily ledger and provenance consistency regressions
    - path: frontend-new/components/ShoppingRecipeSources.tsx
      provides: Accessible reused recipe-source reveal and icons
  key_links:
    - from: frontend-new/lib/shopping-provenance.ts
      to: frontend-new/lib/ingredient-ledger.ts
      via: buildFinalIngredientLedger and ingredientLedgerKey, without portion recalculation
    - from: frontend-new/app/meals/page.tsx
      to: frontend-new/lib/shopping-approval.ts
      via: Existing exact-plan/preference approval guard before list visibility
    - from: frontend-new/app/meals/page.tsx
      to: frontend-new/components/ShoppingRecipeSources.tsx
      via: Grouped current-plan recipe contributions per ingredient
---

<objective>
Finish SCRUM-28 by reusing the existing daily ledger, approval, department grouping and source UI. Correct the verified title-only source identity defect, prove daily aggregation/provenance arithmetic, and expose loading/empty states. Preserve weekly behaviour and existing exact quantities. No new ledger, taxonomy model, schema, dependency, deployment, merge or unrelated Jira changes.
</objective>

<context>
@.planning/STATE.md
@frontend-new/lib/ingredient-ledger.ts
@frontend-new/lib/ingredient-display.ts
@frontend-new/lib/shopping-provenance.ts
@frontend-new/lib/shopping-approval.ts
@frontend-new/lib/shopping-departments.ts
@frontend-new/components/ShoppingRecipeSources.tsx
@frontend-new/app/api/shopping-list/route.ts
@frontend-new/tests/orchestration/shopping-route-consistency.test.ts
@frontend-new/tests/orchestration/shopping-approval.test.ts

Discovery Level 0: all changes use existing internal types, MUI and test harnesses. Checked project OpenSpec skill indexes; none applies to this Jira/GSD task. No CLAUDE.md was present in discovery. Supplied AGENTS instructions remain authoritative.

Verified implemented: buildFinalIngredientLedger sums final materialized quantities without dividing servings or rescaling portions, converts exact kg/g and L/ml, uses curated compatible name aliases and keeps food forms/dimensions separate. Display rounding never rewrites underlying quantities. Shopping GET/POST reapprove current saved restrictions and use scoped complete revisions. approvedShoppingItems invalidates on plan/preference/auth changes. Current daily browser list has 17 approved items. Existing automated suites already cover SI boundaries, fractional portions, small positive amounts, safe alias/form separation, dietary rejection, same-plan changes, revision reload and day/week isolation.

Verified gaps: shoppingMealSources groups only by display title, so different recipe identities/versions sharing a title are conflated; ShoppingRecipeSources also uses title as React key. The page's shopping loading/empty messages are nested beneath displayShoppingList.length > 0, while the approval guard hides that list during checks, so these states can disappear.

Reuse authorisation: uncommitted meals/page.tsx department/source-view changes and the untracked ShoppingRecipeSources.tsx, shopping-departments.ts and shopping-departments.test.ts originate from prior authorised SCRUM-7/8 work and are required by this card. Parent permits adopting and committing these existing changes here after inspecting the full diff. Preserve them; do not mark SCRUM-7/8 Done or modify their scope. All SCRUM-25/27 page changes are already committed. Do not stage unrelated planning/debug/private snapshot files.

Do not group by coarse taxonomy IDs: current milk taxon includes yogurt and whey, and ingredient preparation forms matter. Preserve the existing reviewed-compatible alias/form identity rather than introducing a competing canonical data model. Broader catalogue identity work belongs to SCRUM-14.

Interface: current ShoppingMealSource is {title,meals,quantity,unit}; current SourceMeal extends FinalMealForShopping with title. Add optional recipeId/recipeVersion metadata using existing meal baseId/recipeVersion, retaining title-only fallback for legacy fixtures without identity. Existing sources lacking IDs must remain readable. Recipe grouping and React keys use the same stable identity; quantity arithmetic remains entirely in the ledger.
</context>

<tasks>
<task type="auto" tdd="true">
  <name>Task 1: Preserve exact daily contributions and distinguish recipe source identities</name>
  <files>frontend-new/lib/shopping-provenance.ts, frontend-new/components/ShoppingRecipeSources.tsx, frontend-new/tests/orchestration/shopping-provenance.test.ts, frontend-new/tests/orchestration/daily-shopping.test.ts</files>
  <behavior>Repeated occurrences of the same recipe/version group with the correct count; same-title distinct IDs or versions remain distinct. The daily builder's consolidated total equals the sum of its current source contributions across five meals, compatible mass/volume conversions and repeated recipes. A swapped/reloaded day loses obsolete source references. Display rounding does not change stored quantities, and fresh/tinned tomatoes remain distinct.</behavior>
  <action>Write failing stable-identity regressions first. Extend the existing SourceMeal input with optional baseId and recipeVersion, and ShoppingMealSource with optional recipe identity metadata. Group known recipes by ID plus version; use title fallback only when the source meal lacks identity, never merge an identified recipe into an unidentified same-title record. Preserve the old output shape for legacy inputs where practical so existing consumers remain compatible. Update React list keys to identity/version with the same legacy fallback. Keep source names accessible in both reveal and inline icon modes. Add a focused daily integration fixture using the production buildShoppingList/ledger, shoppingMealSources and formatShoppingLineForDisplay: five contributions, shared ingredients, g/kg and ml/L, multi-serving materialization applied once, repeated recipes, distinct forms, small positive amounts, immutable input and exact source-total equality. Clone/reload the daily fixture and replace a meal to prove no old ingredient/source survives. Reuse existing tests for owner/restriction and scoped revision approval instead of recreating that pipeline. Fix any discovered arithmetic defect only in the existing ledger, never by a second normalization or portion pass.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/daily-shopping.test.ts tests/orchestration/shopping-provenance.test.ts tests/orchestration/ingredient-ledger-consistency.test.ts tests/orchestration/ingredient-display.test.ts tests/orchestration/shopping-route-consistency.test.ts tests/orchestration/shopping-approval.test.ts</automated></verify>
  <done>Stable recipe/version provenance is correct and daily totals, source contributions and presentation agree without mutating approved portions or merging distinct food forms. Existing weekly and approval regressions remain green.</done>
</task>

<task type="auto">
  <name>Task 2: Adopt the existing shopping UI and expose truthful daily states</name>
  <files>frontend-new/app/meals/page.tsx, frontend-new/lib/shopping-departments.ts, frontend-new/components/ShoppingRecipeSources.tsx, frontend-new/tests/orchestration/shopping-departments.test.ts</files>
  <action>Review and reuse the prior authorised category grouping and source reveal/inline controls already present in the working tree. Do not redesign them or replace the ledger. Make shopping verification progress visible outside the nonempty approved-list conditional, using a short status message while the current plan's shopping request is pending. Show an explicit no-ingredients-to-buy state for a genuinely empty current day's requirement, without claiming an unchecked basket is approved. Keep rejected/network errors and retry visible outside that conditional, retain the server approval gate, and avoid duplicate error messages. Label listed amounts as recipe requirements; purchase-pack quantities and pricing remain SCRUM-29 scope. Inspect the complete page diff before staging; it may include the known SCRUM-7/8 adoption plus this task's state changes, but no unrelated content or private evidence. Run the targeted checks, full suite with local HTTP access, TypeScript and ESLint. Verify the local daily list, category totals, source reveal via keyboard/tap, and an actual swap/reload using browser automation where available; record results without changing user restrictions. Preserve weekly scope and food-out exceptions. Commit only the explicit source/test paths, not the entire workspace.</action>
  <verify><automated>cd frontend-new; node --test tests/orchestration/shopping-departments.test.ts tests/orchestration/daily-shopping.test.ts tests/orchestration/shopping-approval.test.ts; npm run test:orchestration; npx tsc --noEmit --incremental false; npm run lint</automated></verify>
  <done>Daily shopping categories and accessible recipe sources are reachable, loading/empty/rejected states are understandable, and no unapproved or stale list is displayed. All checks and any limitations are recorded before Review.</done>
</task>
</tasks>

<threat_model>
| Threat ID | Boundary | Disposition | Mitigation |
|---|---|---|---|
| T-28-01 | Plan/preferences/session to visible shopping requirements | mitigate | Preserve approvedShoppingItems exact snapshot/auth gate and existing route approval/revision checks |
| T-28-02 | Repeated recipe display names to ingredient provenance | mitigate | Stable recipe ID/version grouping and matching React keys; legacy-only title fallback |
| T-28-03 | Formatting/purchase presentation to ingredient arithmetic | mitigate | Ledger remains authoritative; display-only rounding and regression equality between sources and totals |
</threat_model>

<verification>
AC coverage: approved-day ledger derivation Task1 with existing route gates; compatible canonical form and units Task1; internal precision/readable amounts Task1; categories and Used in Tasks1/2; swap/reload/revision invalidation Task1 plus existing scoped route tests; unverified/stale visibility existing approval test plus Task2; empty/loading/rejected states Task2. Baseline 227 passing orchestration tests, TypeScript pass and nine ESLint warnings. Source fixtures and live checks must not alter hard restrictions or approved recipe versions.
</verification>

<success_criteria>
All SCRUM-28 criteria have verified evidence using the existing architecture. Distinct same-title recipes no longer merge their provenance. Listed requirements equal the approved day's recipe contributions, remain exact internally and readable in the UI, and cannot survive invalidated approval. Known prior category/source changes are reused and scoped explicitly. No duplicate ledger/model, schema/dependency change, live recipe write, deployment or merge.
</success_criteria>

<output>
Create .planning/quick/261104-not-scrum-28-exact-consolidated-daily-shoppi/261104-not-SUMMARY.md after execution with changes, test results, browser evidence and acceptance limitations. Parent owns STATE and Jira transitions.
</output>
