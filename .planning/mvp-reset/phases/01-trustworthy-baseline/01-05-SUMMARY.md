---
phase: 01-trustworthy-baseline
plan: "05"
subsystem: database-verification
status: automated_verified_locally
tags: [supabase, rls, transactions, test-target]
key-files:
  created:
    - frontend-new/scripts/baseline-database-target.ts
    - frontend-new/tests/orchestration/database-target-guard.test.ts
    - frontend-new/tests/database/baseline.integration.test.ts
    - frontend-new/tests/database/baseline-fixtures.sql
    - .planning/mvp-reset/phases/01-trustworthy-baseline/01-VERIFICATION.md
---

# Phase 1 Plan 05: Isolated database evidence gate

A fail-closed validator and real integration harness are implemented and verified. After the original missing-environment checkpoint, the user authorised installation. WSL/Docker/Supabase/psql are now available, and the disposable localhost-only database suite passed 8/8 on 2026-10-29. No hosted application database was changed.

## Task outcomes

| Task | Outcome | Evidence |
|---|---|---|
| 1: Explicit target guard and harness | Implemented locally | Guard RED missing module, then GREEN 4/4 tests; owned-file ESLint exits 0; nonincremental TypeScript exits 0 |
| 2: Actual isolated migrations/RLS/transactions | PASS on 2026-10-29 | User authorised tooling; actual localhost-only Supabase/PostgreSQL suite passed 8/8, zero skips; see 01-DATABASE-TEST.log |

## Commands actually executed

From frontend-new:

- `node --test tests/orchestration/database-target-guard.test.ts`: 4 passed, 0 failed.
- `node --test tests/database/baseline.integration.test.ts`: expected nonzero BLOCKED with absent explicit environment; 0 database scenarios ran.
- `.\node_modules\.bin\tsc.cmd --noEmit --incremental false`: exit 0, no diagnostics.
- `.\node_modules\.bin\eslint.cmd scripts/baseline-database-target.ts tests/orchestration/database-target-guard.test.ts tests/database/baseline.integration.test.ts --no-cache`: exit 0.

The original harness-authoring step performed no external writes. The subsequent authorised local verification installed tooling and applied migrations/fixtures only to the disposable local stack. Unrelated changes and the hosted application database were preserved; no commits were created.

## Real scenarios executed successfully on 2026-10-29

- Fresh public-schema and actual database-name guard, then real migration application in both structured/trusted addition orders inside separate rollback transactions; actual chronological application afterwards.
- Four synthetic Auth identities (two owners, reviewer, first-save identity); anonymous and ordinary-user operational-table/RPC denial.
- Concurrent review yields exactly one approved N+1 version and one conflict, real import evidence linkage, explicit legacy provenance, approved record and review-event mutation denial.
- Trigger-injected review-event failure rolls back both draft closure and new version.
- Omitted never-food/preparation keys survive, owner A cannot access B, supplied owner override is rejected.
- Concurrent first saves preserve combined allergies; profile/preferences/allergy stores union; trigger-injected allergy insertion failure preserves complete prior snapshots.

All scenarios above executed against the disposable local PostgreSQL 17 instance. This is real database evidence, not a mocked-client result. The configured user-data project remains unchanged. Earlier missing-environment negative checks above are historical evidence that the guard fails closed.

## Environment contract

Supply only explicit test-prefixed values, outside chat: `OVONA_BASELINE_TEST_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DATABASE_URL`, `EXPECTED_HOST`, `EXPECTED_REF`, `EXPECTED_DATABASE`, `DISPOSABLE=true`, `CONFIRM=isolated-fixtures-only`, and `PSQL` (each name prefixed with `OVONA_BASELINE_TEST_`). `PSQL` must be an absolute existing executable path. PostgreSQL credentials are passed through PG environment variables, never process arguments.

For loopback use EXPECTED_REF=local and exactly matching API/SQL hostname. For an explicitly approved remote project also require REMOTE_APPROVED_REF matching EXPECTED_REF, and nonempty PRODUCTION_REFS denylist. Remote API must be `https://<ref>.supabase.co`; direct SQL host must be `db.<ref>.supabase.co`. Pooler/custom-host targets are deliberately unsupported by this harness. It never loads .env.local, installs a runner, executes linked push/reset, or cleans up remote resources. It refuses any target with existing public tables; provide a fresh dedicated environment, not the configured user-data project.

## Deviations and deferred items

Parent authorised preparing independent harness while Plan04 quality work finishes. Final phase disposition still depends on its final gates. Missing database environment is an explicit blocker, not an auth error, pass, skipped test, or implied approval to provision infrastructure. No actual-route against live database check was attempted; production route semantics are covered locally by Plans01/03, with real RPC behaviour still pending. The existing broad plant-protein daily cap remains a separately documented vegan scheduling limitation.

## Self-Check: PASSED FOR LOCAL AUTOMATED VERIFICATION

All local artifacts and actual database scenarios pass. Runtime setup is recorded in 01-LOCAL-TOOLS.md; the runner is .planning/mvp-reset/run-disposable-verification.ps1. Real execution corrected inherited PG environment handling and migration CASE syntax, and added a stop-after-failed-bootstrap assertion. Browser acceptance and live rollout remain separate, unperformed steps; Phase 2 has not started.
