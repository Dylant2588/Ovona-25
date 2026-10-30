---
phase: 01-trustworthy-baseline
status: planned
date: 2026-10-28
nyquist_compliant: false
wave_0_complete: false
---

# Phase 1 validation strategy

Planning-only document. No implementation checks in this document have been executed. Prior audit baseline: orchestration 55/64 pass, TypeScript no diagnostics, lint 3 errors/10 warnings, quantity regression PASS.

| Requirement | Evidence required | Owner plan |
|---|---|---|
| BASE-01/02 | Review conversion/attestation unit tests and real route-export tests | 01-01 |
| BASE-03 | Transaction rollback, two simultaneous reviews, audit linkage and immutable-version database tests | 01-01 + 01-05 |
| BASE-04 | Saved/requested restriction union and adapter→eligibility→scheduler tests for each supported diet | 01-02 |
| BASE-05 | Omitted patch, schema absence, union, partial failure and concurrent safety-save tests | 01-03 + 01-05 |
| BASE-06/07 | Failure classification matrix; complete suite/lint/typecheck/quantity regression output | 01-04 |
| BASE-08/09 | Target-guard test; real migrations/RLS result; evidence report with PASS/FAIL/BLOCKED per check | 01-05 |

## Commands (future execution, cwd frontend-new)

Existing commands: `npm run test:orchestration`; `.\node_modules\.bin\tsc.cmd --noEmit --incremental false`; `npm run lint -- --no-cache`; `node scripts/ingredient-quantity-regression-test.cjs`.

New test files/commands are planned, not currently present: `node --test tests/orchestration/review-lifecycle.test.ts tests/orchestration/review-route.test.ts`; `node --test tests/orchestration/dietary-generation.test.ts`; `node --test tests/orchestration/preferences-route.test.ts`; `node --test tests/orchestration/database-target-guard.test.ts`; `node --test tests/database/baseline.integration.test.ts`.

Every implementation task creates its tests before requiring them to pass. Add them to the existing orchestration glob wherever applicable; database tests remain a separate explicit command and must fail with a clear environment requirement rather than silently skipping.

## Database safety and required scenarios

Use only `OVONA_BASELINE_TEST_*` credentials supplied for an isolated target. Before connecting or writing, validate an explicit disposable confirmation, allowlisted expected project identity or loopback host, and mismatch with any production reference. Remote target needs explicit prior user approval. Missing environment exits nonzero with `BLOCKED: disposable database unavailable`. Never echo credentials, reset a linked/default project, use production data or auto-load `.env.local`.

Apply actual migration files in recorded order to a fresh isolated Supabase-compatible target. Exercise structured/trusted-evidence additions in both supported orders on separate clean disposable instances/schema resets, then apply the two proposed Phase 1 migrations. Assert real grants and rows under anonymous, user A, user B and service/reviewer contexts. Tests must cover: zero unauthorised review writes; reviewer RPC checks actor role; non-owner preference access denied; failed review/allergy insert rolls back all state; concurrent review yields exactly one approved version; concurrent allergy additions retain both; approved recipe mutation rejected; unsupported RPC/schema returns 503 without route fallback writes. Record actual migration failures rather than mocking them away.

## Phase completion

PASS requires all local automated gates and actual database scenarios passing, with no skipped required cases and no broadened safety policy. If database tooling/access remains absent, local work can be recorded complete but Phase 1 verification stays BLOCKED. Never change this file's planned status to verified based only on this plan's existence.
