---
phase: 02-catalogue-and-nutrition
verified: 2026-10-29
status: human_needed
software_status: verified
product_readiness: calculated_catalogue_content_review_pending
score: 6/6 scoped software truths verified
overrides_applied: 0
human_verification:
  - test: Complete accountable source, rights, supplier/allergen, method/timing and cook-through review of real calculated recipe versions.
    expected: Only genuinely reviewed calculated versions enter the catalogue; a source-backed pending example is not treated as reviewed coverage.
    why_human: Software arithmetic and synthetic test attestations cannot establish these real-world facts.
  - test: Populate and approve enough calculated recipes for the intended supported profiles, then rerun catalogue coverage.
    expected: Named supported cohorts produce actual seven-day plans with calculated-only recipes, without weakening hard restrictions.
    why_human: The observed hosted catalogue contains 38 legacy-attested approved identities and zero calculated versions; operational content work remains.
  - test: Finish the separately recorded Phase 1 account/token change during an in-flight initial/manual reviewer load.
    expected: The previous identity's queue, messages and attestations never reappear after the change.
    why_human: Session invalidation and ordinary-account denial were observed, but this narrower timing scenario was not executed.
---

# Phase 2 goal verification

**Goal:** Precise ingredient quantities/units/servings, reproducible ingredient-derived nutrition, and truthful reviewed-catalogue coverage. **Status: human_needed.** The software portion is verified; the complete calculated-only catalogue/product goal is not achieved yet. No override or synthetic review is used to count real content as complete.

This independently checks the scoped MVP reset Phase 2, not historical `.planning/phases/02-*`. No root `CLAUDE.md` was present. Available local OpenSpec skill indexes concern a separate workflow; the authorised GSD scope governs this verification. No application edits, database writes, dependency installations or commits were performed by this verifier.

## Observable truths

| # | Truth | Status | Actual evidence |
|---|---|---|---|
| 1 | Ingredient quantity conversion requires finite positive values, compatible dimensions, exact state and explicit density/count/spoon evidence. | VERIFIED | `frontend-new/lib/recipes/quantities.ts`, `convertIngredientQuantity`; malformed objects return structured errors. Independent core tests pass. |
| 2 | Batch and serving nutrition reproduce offline from precise versioned food snapshots, independently of broad allergy taxonomy. | VERIFIED | `nutrition.ts`, `calculateRecipeNutrition` / `calculatedNutritionErrors`; whole-batch summation and one serving division, stored line/source revisions and deterministic output comparison. |
| 3 | New approvals require calculated evidence; existing approved legacy versions remain compatible; portions scale once through the actual planner boundary. | VERIFIED | `repository.ts` calls calculation validation; `imports.ts` calls `newApprovalNutritionErrors`; `review-lifecycle.ts` uses the shared converter; additive SQL review policy rejects new legacy approvals. Independent actual-adapter/final-validator tests pass. |
| 4 | Coverage uses production approval, candidate mapping and scheduler, separates legacy/calculated guarantees, and distinguishes counts from actual feasibility. | VERIFIED | `catalogue-coverage.ts` calls `approveRecipe`, shared `recipesToCandidates` and `orchestrateWeek`; duplicate slot demand, malformed approved-library failure and explicit indeterminate budget result. Hosted snapshot report records 38 legacy / 0 calculated. |
| 5 | A real-source pending recipe can be prepared and atomically imported with provenance, without invented approval or rights/cook-through assertions. | VERIFIED for software/preparation | `prepare-recipe-nutrition.ts` uses exact mappings plus shared calculator/import validator; pinned CoFID slice; one reproducible pending bowl. `recipe-import/route.ts` uses verified reviewer, bounded stream and one service-only transactional RPC; actual database tests cover audit hash, conflicts and rollback. Real review remains pending. |
| 6 | Reviewer diagnostics are usable with malformed/legacy drafts, and executed quality evidence is credible and scoped. | VERIFIED | `reviewQueueEntries` sanitises display records; queue key includes ID/version; final screenshot shows malformed-row diagnostics beside valid source-backed draft, batch/serving/source evidence, unchecked attestations and disabled approval. Final logs show 147/147 plus actual DB 11/11, zero skips. |

**Software score: 6/6.** This score does not assert that a genuine calculated-only reviewed catalogue exists. That operational goal remains open.

## Required artifacts and wiring

All 13 declared artifacts in Plans 01–04 pass the GSD existence/substance checks after the parent completed `02-VERIFICATION.md`. Plan 05's additional route, helpers, migrations and focused tests also exist and contain substantive implementations.

| Artifact group | Level 1–4 result |
|---|---|
| `types.ts`, `quantities.ts`, `nutrition.ts` | Present and substantive; exact source contracts consumed by calculator and boundaries. Pure utilities have no UI data-source requirement. |
| `repository.ts`, `imports.ts`, `review-lifecycle.ts` | Wired to calculation validation and actual import/review/planning callers; no parallel unchecked new-approval converter found. |
| `candidates.ts`, production `candidate-adapter.ts`, `catalogue-coverage.ts` | Shared mapper is used after approval; coverage invokes real scheduler, not a replacement feasibility formula. |
| `scripts/catalogue-coverage.ts` | Explicit file input, validation and deterministic report output; no hidden Supabase/environment reads. |
| `scripts/prepare-recipe-nutrition.ts` and source/mapping/pending JSON | Actual CoFID-derived values flow through exact bindings and calculator into pending records; unknown/trace cells remain unusable. |
| `app/api/recipe-import/route.ts`, `pending-import.ts`, `reviewer-access.ts` | Verified actor → streamed byte bound → full batch validation → `import_pending_recipe_batch`; response checks confirmed count. CLI uses explicit endpoint/token, refuses redirects and avoids printing transport credentials. |
| `20261029090000_calculated_pending_import.sql`, `20261029091000_calculated_review_policy.sql` | Service-only execution, role checks, pending-only ingestion and atomic evidence; new method policy is additive and leaves historical approved rows unchanged. Real disposable execution evidence exists. |
| `app/review-recipes/page.tsx`, `review-queue.ts`, review API | Session token → authenticated GET → database pending rows → tested safe view model → state/render; approval POST → shared proposal → atomic review RPC → refreshed queue. Data is not a static UI placeholder. |
| `02-CATALOGUE-READINESS.md`, `02-VERIFICATION.md` | Present; separate passing software checks from incomplete real content and disclose exact unexecuted timing scenario. |

The generic GSD key-link scanner reported 0/11 literal path matches because these modules use relative/alias imports, shared type contracts and CLI file inputs rather than repository-root target strings. Manual import/call-chain inspection and executed behavior establish these links; no override or code change was used to hide the scanner limitation.

## Independent behavioral spot-checks

| Check | Result |
|---|---|
| `node --test tests/orchestration/recipe-nutrition.test.ts tests/orchestration/calculated-planning.test.ts` | **9/9 PASS**, zero skips, 196.5808ms. Includes hand-computed arithmetic, dimensional/state/source failure cases, stale/tampered calculation rejection and actual adapter/final-validator scaling. |
| Direct file-only `prepareRecipeNutrition` invocation with current source slice/mappings | **PASS**: one pending record, no preparation gaps, per-serving `{calories:373, protein:19, carbs:66, fat:6}`; ingredient flags remain false. No output files written. |
| Direct `reportCatalogueCoverage` on that prepared record | **PASS**: zero approved calculated records and no calculated-only cohort feasibility; pending data cannot establish reviewed coverage. |
| Final browser screenshot inspection | **PASS for recorded visual evidence**: source-backed pending bowl, exact food states/codes/revisions, 745.6-kcal batch / 373-kcal serving, all attestations unchecked and approval disabled. Synthetic approval success is explicitly named. This verifier did not independently operate the live browser. |

## Executed integration evidence inspected

- `02-TESTS.log`: final stable suite **147/147 PASS**, zero failures/skips, 4186.9034ms, after the ID/version queue-selection correction.
- `02-DATABASE-TEST.log`: **11/11 PASS**, zero failures/skips, 25796.2328ms. Includes both migration orders, permission denial, concurrent review/import, immutable attribution/provenance, no-overwrite, canonical source hashes, new legacy-approval denial and injected-failure rollback. Database harness code enforces explicit target identity and fresh public schema before writes. This verifier inspected the log/code and did not rerun the now-populated database.
- `02-LINT.log`: zero errors / ten existing warnings. Parent's final TypeScript and post-queue focused lint commands exited zero; quantity regression passed, as recorded in `02-VERIFICATION.md`.
- `02-REVIEW.md`: independent source review of 37 files, no unresolved findings. Its tests/review are separate evidence from database and browser execution.
- Parent browser/application acceptance records actual local import `{ok:true, imported:2}`, malformed/legacy draft handling, synthetic calculated approval and SQL-confirmed N+1 provenance. The real source-backed bowl remained pending.

## Requirements coverage

| Requirement | Plans | Disposition |
|---|---|---|
| CAT-01 | 01, 04 | SATISFIED in software: explicit quantities, dimensions, evidence and servings; uncertain conversions fail closed. |
| CAT-02 | 01, 02, 04 | SATISFIED in software: reproducible versioned calculations and source-backed pending demonstration. |
| CAT-03 | 02, 03, 05 | SATISFIED in software and isolated integration: strict new-approval boundaries, legacy compatibility, atomic pending/import review path. |
| CAT-04 | 03, 04 | Diagnostic requirement SATISFIED and run against actual approved snapshot. Product readiness remains false for calculated-only coverage, explicitly reported. |
| CAT-05 | 04, 05 | Preparation/ingestion delivered; NEEDS HUMAN for genuine review and enough reviewed content. One pending bowl is not weekly catalogue completion. |
| CAT-06 | All | Executed software/DB gates PASS; one Phase 1 timing-specific subcheck remains explicitly unexecuted. No hosted rollout was part of these checks. |

No CAT requirement is orphaned. No missing implementation, stub, disconnected UI source or unresolved new code defect was found in the inspected phase scope. No TODO/placeholder implementation was found in the new core conversion/calculation/import/preparation helpers. Pending source/rights/cook-through language is an honest operational state, not a completed-feature claim.

## Human and content gates

1. Complete real source/rights, exact food/state/conversion, supplier/allergen and cook-through review. Software arithmetic cannot certify these facts.
2. Prepare and approve enough calculated successors/recipes for the intended supported cohorts, then rerun calculated-only coverage. The hosted snapshot has **38 legacy-attested approved recipes and zero calculated versions**. Mixed three-meal compatibility succeeds; larger bounded probes can be indeterminate, and restrictive/quick profiles do not currently have a successful result. Do not interpret indeterminate as infeasible.
3. Resolve the existing broad plant-protein cap before claiming full vegan-day support; adding recipes alone does not remove that policy limitation. This is not assigned to a later scoped roadmap phase and is not silently deferred as complete.
4. Finish the separately recorded Phase 1 in-flight identity/timing subcheck. Ordinary-account denial and session invalidation are different, already observed scenarios.

Phase 3 saved-plan/shopping revisions, Phase 4 AI adaptations and Phase 5 products/pricing are explicitly later scope; they are not Phase 2 implementation gaps. A separately reviewed hosted rollout is also outstanding. The correct present status is **software verified, real catalogue/content review pending**, not full Phase 2 product-goal completion.
