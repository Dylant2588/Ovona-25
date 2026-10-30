---
phase: 02-catalogue-and-nutrition
reviewed: 2026-10-29
depth: standard
files_reviewed: 37
files_reviewed_list:
  - frontend-new/lib/recipes/types.ts
  - frontend-new/lib/recipes/quantities.ts
  - frontend-new/lib/recipes/nutrition.ts
  - frontend-new/tests/orchestration/recipe-nutrition.test.ts
  - frontend-new/tests/orchestration/calculated-recipe-fixtures.ts
  - frontend-new/lib/recipes/repository.ts
  - frontend-new/lib/recipes/imports.ts
  - frontend-new/lib/recipes/review-lifecycle.ts
  - frontend-new/app/api/recipe-review/route.ts
  - frontend-new/app/review-recipes/page.tsx
  - frontend-new/scripts/review-recipe-library.cjs
  - frontend-new/scripts/import-recipe-library.cjs
  - frontend-new/lib/recipes/candidates.ts
  - frontend-new/lib/recipes/catalogue-coverage.ts
  - frontend-new/scripts/catalogue-coverage.ts
  - frontend-new/tests/orchestration/catalogue-coverage.test.ts
  - frontend-new/lib/orchestration/candidate-adapter.ts
  - frontend-new/tests/orchestration/review-route.test.ts
  - frontend-new/lib/recipes/pending-import.ts
  - frontend-new/lib/recipes/reviewer-access.ts
  - frontend-new/lib/recipes/review-queue.ts
  - frontend-new/app/api/recipe-import/route.ts
  - frontend-new/supabase/migrations/20261029090000_calculated_pending_import.sql
  - frontend-new/supabase/migrations/20261029091000_calculated_review_policy.sql
  - frontend-new/scripts/prepare-recipe-nutrition.ts
  - frontend-new/data/nutrition/cofid-2021-slice.json
  - frontend-new/data/recipes/nutrition-mappings.json
  - frontend-new/data/recipes/calculated-pending.json
  - frontend-new/tests/orchestration/pending-import.test.ts
  - frontend-new/tests/orchestration/review-queue.test.ts
  - frontend-new/tests/orchestration/nutrition-preparation.test.ts
  - frontend-new/tests/orchestration/recipe-cli-boundaries.test.ts
  - frontend-new/tests/database/baseline.integration.test.ts
  - frontend-new/lib/recipes/REVIEW.md
  - frontend-new/tests/orchestration/recipe-imports.test.ts
  - frontend-new/tests/orchestration/review-lifecycle.test.ts
  - frontend-new/tests/orchestration/calculated-planning.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 2 code review

Reviewed core calculation, source/state and unit contracts, import/review boundaries, shared candidate mapping, scheduler-backed coverage, real-source preparation and the atomic pending-import amendment. No source files were changed by the reviewer. All three actionable findings raised during review are resolved; no unresolved critical, warning or informational findings remain in the listed scope.

Final focused execution across ten Phase 2 test files: **50/50 pass**, zero skips, 3289.2767 ms. The calculation preserves batch quantities, divides by servings once, and recomputes claimed outputs. New approval conversion requires calculated evidence while existing approved legacy reads remain compatible. CLI direct table writes are removed; pending apply uses the explicit authenticated endpoint and atomic import transaction, while approvals use the existing review workflow. Coverage runs real admission and scheduling, separates calculated/legacy guarantees, and reports search-budget exhaustion as indeterminate.

Final queue-identity follow-up: inspected `reviewQueueKey`, all workspace selection/React-key comparisons, and the added version captions. Keys encode `[recipe ID, version]` as JSON, so simultaneous pending versions and colon-containing IDs remain distinct. The focused queue suite passed **4/4**, zero skips, after this correction. The 50-test run above predates that additional test; no second full-suite run is claimed by this reviewer. Clean source-review status is unchanged.

## Findings resolved during review

### WR-03: Malformed import tokens can be disclosed in CLI error output

**File:** `C:/Users/u1434/OneDrive/Documents/Ovona 25/frontend-new/scripts/import-recipe-library.cjs:28`

**Original issue:** Node's malformed header validation can echo a bearer token copied with a newline, and the CLI previously printed that raw error message. Reproduced with a synthetic token only.

**Resolution:** Token format is validated before header construction with fixed feedback; transport exceptions are replaced with a generic message. The synthetic credential-disclosure regression and redirect-refusal regression pass. Resolved; excluded from unresolved counts.

### WR-01: Malformed JSON enum objects threw instead of returning diagnostics

Original `String(...)` coercion in `quantities.ts` threw for valid JSON such as `{"toString": null}` in unit/state fields. Reproduced independently through `calculateRecipeNutrition`. Explicit string guards now replace those coercions, including nested count/spoon units; the new malformed-object regression passes. This finding is resolved and excluded from unresolved counts.

### WR-02: Malformed and legacy optional evidence could crash review rendering

The repository now avoids hostile enum coercion. `reviewQueueEntries` validates the renderable shape, preserves invalid rows as safe ID/version/error entries and strips unvalidated optional calculation/source blocks from legacy display records without mutating input. The UI gates calculated breakdowns and invalid-row details. Malformed shape, hostile enum and legacy optional evidence regressions pass. This finding is resolved and excluded from unresolved counts.

## SQL, source and execution evidence

The service-only import RPC locks the reviewer role, bounds and validates the batch, inserts pending library rows and matching source audit snapshots in one transaction, derives the payload SHA256 from PostgreSQL's canonical JSON text, and relies on the library primary key for concurrent duplicate conflicts. It never overwrites an existing version. SQL grants, actor checks, stable lock order and rollback-test assertions were inspected. The replacement review RPC was mechanically compared with the Phase 1 baseline: its function body matches exactly after removing only the new calculated-method/calculation/policy guard. Existing row/event locks, content equality, version transition and provenance logic are retained. Full nutrient recomputation remains in the shared TypeScript validation boundary; SQL does not introduce a competing nutrient formula.

The application source slice is byte-identical to the pinned research extract. Exact raw rice, raw baby spinach and cooked/drained chickpea mappings reproduce the checked-in pending bowl and hand-computed totals; olive-oil trace protein remains unknown. Input bindings include name, taxon, amount, unit, servings, food code, source version/hash and state. Preparation never promotes a draft or supplies cooked/rights/allergen attestations. The source-backed demonstrator is pending and does not establish reviewed weekly coverage.

The redirect regression initially failed in the restricted execution sandbox because its synthetic child process could not reach the local HTTP server. The exact focused test passed with local-network-enabled execution, as did the final 50-test run. This was an environment restriction, not a relaxed assertion or skipped test.

The reviewer did **not** execute database migrations, the complete application quality gate, hosted reads/writes, browser acceptance, or a real cook-through. The parent must retain its fresh disposable database, full TypeScript/lint/regression and browser gates. This clean source-review result is not a claim that those gates ran or that real calculated catalogue coverage is complete.

## Execution amendment review

Plan 02-05 closes the operational gap left by disabling the old unaudited direct-write import CLI. The reviewer-authenticated, service-only atomic pending import reuses existing tables and attribution; no architectural blocker was found in the plan. Its route, helper, SQL and test additions are included in the 37 reviewed files. Bounded streaming body/batch handling, verified actor/role checks, uniqueness/transaction design, source hash derivation, no overwrites and CLI redirect refusal were reviewed. Actual database execution remains the parent's separate gate.
