---
phase: 02-catalogue-and-nutrition
plan: 02
subsystem: recipe-review
status: implemented_locally_database_browser_pending
tags: [nutrition, recipe-approval, provenance, validation]
requires: [02-01]
provides: [strict-new-approval-nutrition, legacy-read-compatibility, reviewer-breakdown, cli-bypass-protection]
affects: [02-04, catalogue-operations]
tech-stack:
  added: []
key-files:
  created: [frontend-new/tests/orchestration/calculated-planning.test.ts, frontend-new/tests/orchestration/recipe-cli-boundaries.test.ts]
  modified: [frontend-new/lib/recipes/repository.ts, frontend-new/lib/recipes/imports.ts, frontend-new/app/api/recipe-review/route.ts, frontend-new/app/review-recipes/page.tsx, frontend-new/tests/database/baseline.integration.test.ts, frontend-new/scripts/import-recipe-library.cjs, frontend-new/scripts/review-recipe-library.cjs]
requirements-completed: [CAT-02, CAT-03]
completed: 2026-10-29
---

# Phase 2 Plan 02: Calculated nutrition across review and planning

New recipe approvals require reproducible ingredient calculations through the shared converter; existing approved legacy versions remain readable without invented calculation claims.

## Tasks

1. Structural/import/load validation calls `calculatedNutritionErrors` for claimed calculations. The exported `approveImportedRecipeVersion` requires `newApprovalNutritionErrors`, so callers cannot bypass the rule by changing the method or skipping `proposeReviewedVersion`. Positive transition tests use separate synthetic calculated fixtures; existing legacy approved fixtures remain unchanged. Invalid import structure returns errors before dereferencing malformed evidence.
2. The actual review GET includes structural and new-approval errors. The reviewer page distinguishes calculated versus legacy preparation and displays per-serving/batch nutrition plus exact source dataset/version/code/revision. Existing five attestations, rejection path and token-keyed workspace remain intact. The database harness now creates calculated pending fixtures, while retaining its fresh-target guard, concurrency, permission, provenance and rollback assertions. Real adapter/final-validator tests prove 400g / 2 servings = 200g base, then 1.5 portions = 300g, without double scaling.
3. The review CLI's direct same-version approval write is removed; `--apply` always directs operators to the verified atomic reviewer workflow. Import dry-run validates every item with `createPendingRecipeImport`, actual local SHA256 and explicitly nonpersisted dry-run attribution. The old import apply path is disabled because it wrote only `recipe_library`, not atomically linked `recipe_imports` evidence. No CLI database clients or credential reads remain.

## Verification executed

- RED: three new lifecycle/import assertions failed before implementation, demonstrating missing calculated boundary enforcement.
- Core/import/lifecycle focused run: 15/15 passing at that checkpoint.
- Final plan-focused run: 21/21 tests passing, zero skipped (imports, lifecycle, actual route, actual planner/final validation, actual CLI subprocesses).
- TypeScript `npx tsc --noEmit --incremental false`: passed after explicitly typing child-process NODE_ENV, which Next's ProcessEnv requires.
- Focused ESLint across owned application, CLI and test files: zero errors/warnings (existing baseline-browser-mapping age notice only).
- Actual database and browser verification are reserved for the parent against the disposable target in Plan 04; they were not executed by this agent. No hosted environment or data accessed.

## Operational limitation and parent decision

No existing atomic recipe-import RPC/route was found. `recipe_imports` exists but the previous CLI never persisted it. Consequently source-backed pending preparation is file-only until a verified importer workflow atomically inserts the draft and real import audit. This fail-closed behavior is explicitly permitted by Task 3, but remains an operational ingestion gap; it must not be reported as a fully usable production catalogue import workflow.

Minimal proposed follow-up (reported to parent, not implemented): an additive service-only pending-batch import RPC that checks a verified reviewer/admin actor, rejects duplicate/conflicting versions, computes source hashes and inserts `recipe_library` plus `recipe_imports` in one transaction, with rollback/permission tests. No automatic approval or new table is necessary.

## Deviations

- [Rule 1 — Bug] Shared import validation now returns structural errors before accessing malformed source/review data, so hostile CLI JSON fails safely.
- No commits were created, per the parent's explicit instruction to preserve the mixed working tree. Historical planning state was not modified.

## Known stubs and threat surface

No new network endpoint or schema was added. Import `--apply` intentionally fails closed and clearly explains the missing atomic audit workflow; it is an explicit operational gap, not a hidden stub. The new UI consumes existing authenticated review evidence and exposes no credentials.

## Self-Check: PASSED

Created tests and modified boundary/CLI/UI files exist; focused behavioral checks passed. Review lifecycle source itself needed no change because its existing converter call now inherits the strict shared policy. No claim is made that actual human catalogue review, browser acceptance or disposable database execution was completed by this plan executor.
