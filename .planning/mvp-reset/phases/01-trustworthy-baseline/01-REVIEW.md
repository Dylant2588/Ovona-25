---
phase: 01-trustworthy-baseline
reviewed: 2026-10-29
depth: standard
files_reviewed: 29
files_reviewed_list:
  - frontend-new/lib/recipes/review-lifecycle.ts
  - frontend-new/lib/recipe-reviewer.ts
  - frontend-new/app/api/recipe-review/route.ts
  - frontend-new/supabase/migrations/20261028090000_baseline_review_transition.sql
  - frontend-new/lib/recipes/server-constraints.ts
  - frontend-new/lib/generation/context-builder.ts
  - frontend-new/lib/orchestration/candidate-adapter.ts
  - frontend-new/lib/preferences-persistence.ts
  - frontend-new/app/api/preferences/route.ts
  - frontend-new/supabase/migrations/20261028091000_baseline_safety_preferences.sql
  - frontend-new/app/onboarding/page.tsx
  - frontend-new/app/meals/page.tsx
  - frontend-new/tests/orchestration/review-lifecycle.test.ts
  - frontend-new/tests/orchestration/review-route.test.ts
  - frontend-new/tests/orchestration/preferences-route.test.ts
  - frontend-new/tests/orchestration/dietary-generation.test.ts
  - frontend-new/tests/orchestration/planning-input.test.ts
  - frontend-new/scripts/fallback-regression-test.cjs
  - frontend-new/tests/orchestration/validate.test.ts
  - frontend-new/tests/orchestration/replace.test.ts
  - frontend-new/tests/orchestration/meal-approval.test.ts
  - frontend-new/tests/orchestration/trusted-planning-schema.test.ts
  - frontend-new/tests/orchestration/meal-variety.test.ts
  - frontend-new/app/review-recipes/page.tsx
  - frontend-new/tests/database/baseline.integration.test.ts
  - frontend-new/tests/database/baseline-fixtures.sql
  - frontend-new/scripts/baseline-database-target.ts
  - .planning/mvp-reset/run-disposable-verification.ps1
  - .planning/mvp-reset/bind-disposable-localhost.cjs
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 1: scoped code review

## Summary

Reviewed the Wave 1 lifecycle, authenticated routes, dietary admission, preference parser/persistence contract, caller changes, and regression tests, plus Plan 04 baseline-test corrections and reviewer UI lifecycle. The review is static source analysis; no SQL was applied and no live user data was read or modified.

The review transition preserves the original recipe snapshot under a row lock, validates a verified reviewer before privileged access, checks the reviewer role again inside the service-only transaction, and commits version/evidence updates together. The preference transaction derives its owner from `auth.uid()`, restricts patch keys, serialises first-time and existing-user saves using an owner advisory lock, and preserves omitted fields. Dietary admission merges saved exclusions and includes cross-contact evidence. Tests execute production route exports with injected dependencies rather than copied route implementations.

The initially identified caller/API mismatch and reviewer-state lifecycle issue have been corrected and independently rechecked. No unresolved code-review findings remain in this scope. The post-database addendum distinguishes static code review from the actual isolated test log now available.

## Resolved finding

### WR-01: Standard preparation option sent a null that the new API rejects — resolved

**File:** `C:/Users/u1434/OneDrive/Documents/Ovona 25/frontend-new/app/meals/page.tsx:1687`

**Related:** `frontend-new/app/meals/page.tsx:624`, `frontend-new/app/meals/page.tsx:3419`, `frontend-new/lib/preferences-persistence.ts:41`.

**Issue:** The existing `Standard 30-minute limit` option is represented as `maxPrepMinutes: null`, and the preference-save handler always serialises that value. The new parser deliberately rejects explicit null preparation limits. Consequently, an account with the default/unset limit cannot save any changes through this form: its request returns HTTP 400 before the transaction, even after the migration is available. The parser's null-rejection test passes but no test exercises this actual caller-shaped payload.

**Fix:** Keep null rejected by the API. Normalise the standard UI choice into the numeric value `30` before constructing both `nextPreferences` and the API payload, or omit the request key where the intended action is preserving the existing saved limit. Ensure the chosen approach cannot clear an existing stricter saved limit implicitly. Add a regression using the default preference-panel payload and assert it reaches one RPC instead of failing validation. Keep the displayed standard option and generated preference signature consistent with the value saved.

**Recheck:** `preferencePrepLimitForSave()` now maps the displayed standard selection from null to 30, retains explicit numeric limits, and is called by the actual planner save payload. The new actual-POST regression invokes that production bridge and verifies the parser/RPC receives 30, 10, 15 and 45 respectively. Null remains rejected for direct API clients. Existing explicit stricter selections retain their numeric value. This resolves the reported default-form HTTP 400 failure without weakening the API contract. Parent is running the updated targeted suite; this recheck verified the source and assertion path directly.

### WR-02: Reviewer queue could outlive its authentication identity — resolved

**File:** `C:/Users/u1434/OneDrive/Documents/Ovona 25/frontend-new/app/review-recipes/page.tsx:24`.

**Issue found during Plan 04 follow-up:** The initial effect aborted its own fetch, but the manual reload following an approval had no identity/unmount guard. Previous queue/message/attestation state could remain visible while the next identity's request was pending, or an earlier manual reload could finish after a session change.

**Recheck:** The outer page now renders `RecipeReviewWorkspace` keyed by the scalar current access token (or the signed-out key). Every identity change synchronously creates fresh queue, selection, message and attestation state. The old workspace marks its active ref false on unmount; manual reload and review-response success/error/finally paths check that ref. Initial loading retains AbortController cleanup. The next identity cannot receive the old component's state or display its stale queue. This is a bounded lifecycle correction; backend authorisation is still mandatory.

## Plan 04 test review

- Soft dislike admission is paired with hard never-food rejection; original unknown-allergy, allergen and diet negative cases remain.
- Replacement/validation fixtures now carry explicit varied protein categories so they reach the intended layer. Missing-category refusal remains covered.
- Scheduler-stage insufficiency checks are paired with direct real-validator `repair_exhausted` and `practical_quantity_exceeded` assertions; the original safety conditions were not simply deleted.
- Schema source checks now include the implemented rejected-history state while retaining provenance/grant checks. They are not presented as actual database tests.
- Legacy fallback checks retain all five deterministic seeds, allergy/variety/swapping negatives, strict passing calorie/protein/portion bands, stale-total and excessive-portion negatives. Failed enforcement must preserve the original candidate. A constructed known-valid fixture tests enforcement idempotence separately, without claiming those nutrition values came from the legacy generator.
- The prior production-target success guarantee was not repaired: a deterministic 1830/216 restricted request now explicitly proves safe refusal, while the broader generator-fit gap remains documented in the failure matrix. This accepted scope disposition is honest validation of the legacy boundary, not evidence that legacy generation reliably meets targets.
- No test skips or relaxed safety tolerances were introduced in these changes. Parent reports the complete local suite is green; this review inspected the assertion paths rather than rerunning that same suite.

## Post-database addendum — 2026-10-29

Reviewed the final integration harness, explicit target guard, synthetic failure fixtures, disposable-runner PowerShell, localhost-container binding helper, and the parenthesised PL/pgSQL comparison expressions in the safety migration. No new code-review findings were identified.

- The target guard runs before client creation, SQL and network operations. It uses only explicit test settings; the runner reads the separate local Supabase CLI status and does not load the application's environment file. Both database and gateway ports must be loopback-bound before the suite starts.
- The SQL child environment removes inherited `PG*` variables and sets explicit host, port, user, password and database. `psql -X` avoids user startup commands; inherited service/host-address settings cannot override the guarded target. A fresh public-schema assertion runs before migrations.
- Each bootstrap child test must set `bootstrapPassed`; an assertion immediately after it prevents committed migration/fixture application when a child bootstrap failed. Actual migration application is restricted to the disposable target and has no automatic drop/reset of a populated project.
- The binding helper verifies the exact project and workdir labels of both named disposable containers before recreating either. It preserves named volumes and commits the gateway's generated writable-layer configuration into a local image before gateway recreation. Dependent Auth/REST pool restarts are restricted to the named disposable project. This review did not execute the helper or alter containers.
- Parenthesising the `CASE ... END` expressions in comparison conditions resolves the reported PL/pgSQL parse failure without changing the intended numeric bounds.

**Actual execution evidence inspected:** `01-DATABASE-TEST.log` reports 8 tests passed, 0 failed, 0 skipped. Those tests include two real bootstrap orders; anonymous/ordinary-user operational-access denial; a concurrent-review single winner with imported provenance and approved-version protection; explicit legacy provenance plus event-failure rollback; owner-scoped omission preservation and cross-owner denial; and first-save concurrent allergy union plus full rollback after injected insertion failure. This reviewer inspected the log and code; the suite was not rerun against the now-populated disposable target. The parent executed those scenarios and owns final environment attestation and requirement disposition.

## Verification boundaries

- Static review alone does not prove database behaviour. The isolated execution evidence above is now available for the parent to reconcile into BASE-03/05/08 verification; it does not constitute permission to apply migrations to the configured user-data project.
- The configured live application will return an actionable 503 for new review/preference mutations until the unapplied functions are deployed. That is the planned fail-closed deployment prerequisite, not a reason to restore unsafe fallback writes.
- The pre-existing two-`plant`-meals-per-day scheduling rule still blocks a complete genuine vegan day. The implementation and tests explicitly document this separate policy gap without falsifying protein metadata or weakening guards. Dietary admission is repaired; end-to-end vegan scheduling is not claimed complete.
- This review excludes the separately applied recency correction. The Plan 05 harness and the narrowly scoped disposable runner/binding helper were included in the post-database addendum.

_Reviewer: gsd-code-reviewer. No source changes or commits performed._
