---
phase: 02-catalogue-and-nutrition
plan: 05
subsystem: catalogue-ingestion
status: software_verified_locally
requirements-completed: [CAT-03]
completed: 2026-10-29
---

# Phase 2 Plan 05: Atomic pending ingestion and safe review diagnostics

Prepared calculated recipes can enter the pending reviewer queue through a verified, atomic import endpoint, without bypassing actual review or overwriting existing versions.

Parent verification completed: 11/11 actual disposable database tests and 147/147 final regression tests pass. Browser import, calculated synthetic approval/N+1/provenance, malformed diagnostics and legacy block verified; the genuine source-backed recipe remains pending. See `02-VERIFICATION.md`. No hosted migration or write occurred.

## Implementation

- `lib/recipes/reviewer-access.ts` extracts the existing verified-user/reviewer-role guard; both import and review routes reuse it.
- `lib/recipes/pending-import.ts` validates 1–50 complete pending calculated records, rejects duplicate identities, and reads actual request stream bytes with a 1 MiB limit. Excess streams are cancelled before buffering further data. No actor is taken from request JSON.
- `app/api/recipe-import/route.ts` invokes one service-only `import_pending_recipe_batch` RPC using the verified actor and returns safe conflict/validation/availability responses.
- `20261029090000_calculated_pending_import.sql` locks the actor role, validates pending flags/identity, bounds batch JSON, orders inserts consistently, and inserts library rows plus real source/rights/importer snapshots and server-computed canonical JSON SHA256 in one transaction. PK conflicts prevent overwrite/concurrent duplicate success; any error rolls back the whole batch. No automatic approval.
- `20261029091000_calculated_review_policy.sql` additively replaces the existing review function with an explicit calculated-method/calculation-policy requirement for new approvals. Existing approved legacy rows and original Phase 1 migration remain unchanged. Full arithmetic still belongs to the shared calculator, not duplicated SQL.
- Import CLI `--apply` now requires explicit `OVONA_RECIPE_IMPORT_ENDPOINT` and `OVONA_RECIPE_IMPORT_TOKEN`, validates a fixed HTTPS or loopback HTTP API path, forbids redirects and unsafe token whitespace/control characters, and calls the authenticated endpoint. It never uses a service key or `.env.local`; transport errors cannot echo the token. File-only dry-run remains available. This supersedes Plan 02's temporary disabled-import limitation.
- `lib/recipes/review-queue.ts` provides a tested safe view model. Malformed saved rows render only ID/version/errors, while valid rows stay usable. Legacy optional calculation/ingredient-source blobs are removed from the display clone, and calculation breakdown is rendered only for validated calculated records. Repository enums use type guards rather than hostile object coercion.

## Verification

- Focused domain/actual route/CLI/view-model suite: **18/18 pass, zero skips**, run with loopback networking enabled. One CLI test serves an actual local HTTP 307 and verifies one import request and zero forwarded requests; sandbox networking initially blocked the connection, then the same unchanged test passed outside that restriction.
- Actual malformed-token CLI subprocess test confirms synthetic token contents never appear in output.
- Chunked request test omits Content-Length, exceeds the actual byte bound, verifies stream cancellation and zero RPC calls.
- Shared reviewer auth remains covered by the actual review-route harness, including verified identity, reviewer roles and unavailable auth.
- Database harness extended with three substantive subtests: service-only/atomic imported provenance plus real pending→review linkage; concurrent duplicate and injected audit-failure whole-batch rollback; direct SQL legacy-approval and malformed-import rejection. The parent must execute these only against a fresh disposable target. This agent did not run the database suite or browser.

## Files for isolated application verification

Copy `lib/recipes/pending-import.ts`, `reviewer-access.ts`, `review-queue.ts`, `repository.ts`, existing core nutrition/quantity/types modules, `app/api/recipe-import/route.ts`, `app/api/recipe-review/route.ts`, and `app/review-recipes/page.tsx`. Apply both additive migrations only to the verified disposable test target.

## Deviations and limits

This is an authorised scoped gap plan: the old import path lost audit provenance, and malformed pending rows crashed the reviewer page. The parent explicitly authorised the necessary additive RPC/API and extra SQL approval guard. No new tables, dependencies, hosted writes, commits or historical planning edits were made. Human recipe rights, source mapping, allergy verification and cook-through attestations remain real review work.

## Threat flags

New privileged POST and RPC boundaries are protected by shared verified reviewer access, service-only execution, row-locked actor role checks, bounded actual input, pending-only immutable inserts and atomic audit persistence. CLI bearer forwarding is limited to an explicit fixed endpoint with redirect refusal and safe error messages.

## Self-Check: PASSED

All named source, migration and test files exist. Focused tests passed. Actual database/browser acceptance remains with the parent and is not claimed here.
