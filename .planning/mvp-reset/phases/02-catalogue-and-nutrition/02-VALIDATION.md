---
phase: 02-catalogue-and-nutrition
status: software_verified_content_review_pending
nyquist_compliant: true
wave_0_complete: true
updated: 2026-10-29
---

# Validation strategy

Execution outcome: final 147/147 regression tests and 11/11 actual guarded disposable database tests pass, zero skips. TypeScript and quantity regression pass; lint has zero errors/ten existing warnings. Actual import/review/legacy/malformed-draft browser acceptance passed. Final details, content-review gate and the separate Phase 1 timing-specific unexecuted subcheck: `02-VERIFICATION.md`.

Existing Node built-in tests, TypeScript and ESLint; no new framework or packages. Tests are created in each task before implementation, using explicitly synthetic source fixtures for hand-calculated expectations. Real source content is verified separately and never inferred from fixture success.

| Task | Requirement | Automated evidence |
|---|---|---|
| 01/1 | CAT-01 | recipe-nutrition.test.ts: units, density/count/spoon references, invalid inputs/state |
| 01/2 | CAT-02 | recipe-nutrition.test.ts: line/batch/serving arithmetic, rounding, source identity, tampering |
| 02/1 | CAT-03 | recipe-imports.test.ts + review-lifecycle.test.ts: shared strict new approval and legacy reads |
| 02/2 | CAT-03/06 | review-route.test.ts + calculated-planning.test.ts: no-write failures, actual adapter/final validator |
| 02/3 | CAT-03/06 | recipe-cli-boundaries.test.ts: actual operational CLI rejects weak imports/direct approval writes |
| 03/1 | CAT-04 | catalogue-coverage.test.ts + existing admission tests: demand/capacity versus actual feasibility |
| 03/2 | CAT-04 | catalogue-coverage.test.ts: CLI input validation, deterministic matrix/results |
| 04/1 | CAT-05 | nutrition-preparation.test.ts: exact mappings, source qualifiers, no false review, deterministic files |
| 04/2 | CAT-06 | full orchestration suite, tsc, lint, quantity regression and guarded real DB suite |
| 05/1–2 | CAT-03/05/06 | pending-import/review-queue/CLI tests; actual atomic import, policy denial, concurrent conflict and injected rollback database checks |

Run focused task commands after each meaningful change. Run the full suite after integrated waves and at the final gate; broaden only for new failures. Each focused command should finish within 60 seconds; a stalled scheduling probe is indeterminate and must not become a coverage pass.

Database test command: run `.planning/mvp-reset/run-disposable-verification.ps1` from the repository root with an absolute capture path after confirming its target is fresh and disposable. It must reject a populated or unapproved target before any cleanup/migration. Existing updated baseline.integration.test.ts proves actual source calculation snapshots survive atomic review, conflict, rollback and grants/RLS. Never read `.env.local` to find a destructive test target.

Browser acceptance: on separate disposable app only, inspect valid calculated breakdown and legacy/incomplete blocking message; exercise approval with all five attestations on explicitly synthetic fixtures; verify queue refresh and existing session reset behavior. Real recipes are never test-approved.

Final evidence must report commands, actual outcomes, environment, actual catalogue cohort results, remaining source/rights/cook-through work and any blocked checks. No skipped check is called passed. Software verification and genuine reviewed content coverage are separate completion claims.
