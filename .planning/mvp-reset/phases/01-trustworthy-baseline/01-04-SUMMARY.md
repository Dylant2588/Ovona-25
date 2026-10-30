---
phase: 01-trustworthy-baseline
plan: "04"
subsystem: validation-and-review-ui
tags: [tests, safety, eslint, react]
requires: [01-01, 01-02, 01-03]
provides: [classified-baseline-failures, green-local-gates, asynchronous-review-loading]
affects: [01-05]
tech-stack:
  added: []
  patterns: [node-test-runner, abortable-react-fetch]
key-files:
  created:
    - .planning/mvp-reset/phases/01-trustworthy-baseline/01-FAILURE-MATRIX.md
  modified:
    - frontend-new/tests/orchestration/meal-approval.test.ts
    - frontend-new/tests/orchestration/trusted-planning-schema.test.ts
    - frontend-new/tests/orchestration/replace.test.ts
    - frontend-new/tests/orchestration/validate.test.ts
    - frontend-new/tests/orchestration/meal-variety.test.ts
    - frontend-new/scripts/fallback-regression-test.cjs
    - frontend-new/app/review-recipes/page.tsx
metrics:
  completed: 2026-10-28
  tasks: 2
  commits: 0
---

# Phase 1 Plan 04: Meaningful local quality gates

The nine audited failures are classified and resolved without changing calorie/protein bands, portion bounds, repetition caps, practical quantity limits, allergy checks or review evidence rules. The combined suite passes with the new Phase 1 route/diet tests included.

## Tasks completed

1. Corrected policy expectations and incomplete fixtures; added direct validator assertions so early scheduler rejection cannot hide repair/practical-limit coverage. Added a missing-protein-metadata refusal test. Kept all test cases and negative controls.
2. Reviewer loading uses scalar token dependencies, abortable asynchronous initial fetch, derived signed-out state and error/finally handling. A keyed workspace remounts all queue/attestation/message state when the token changes, and an unmount guard ignores stale manual reload and review responses. Manual reload after a saved review remains. No lint suppressions or layout redesign.

## Verification

Run from frontend-new:

| Check | Actual result |
|---|---|
| Four corrected approval/schema/replacement/validation files | 16/16 pass, exit 0 |
| Full orchestration suite after combined Phase 1 edits | 103/103 pass, 0 skipped, exit 0 |
| TypeScript --noEmit --incremental false | No diagnostics, exit 0 |
| Reviewer-page ESLint | Exit 0 |
| Full npm run lint -- --no-cache | Zero errors, ten pre-existing warnings, exit 0 |
| Ingredient quantity regression | PASS, exit 0 |
| Fallback boundary/variety regression | PASS, exit 0 |
| Scoped git diff --check | Exit 0; Windows line-ending notices only |

## Deviation and honest limits

The parent explicitly directed a requirement correction for legacy fallback: generation is an untrusted candidate and is not guaranteed macro-feasible. The test now requires either fully checked nutrition within every original band/portion bound or failed enforcement with no mutation. Exact 1830kcal/216g restricted generation refuses at a fixed seed. Positive allergy, cadence, materially different recipes, swap identity and five-seed checks remain. Constructed known-valid nutrition tests idempotent enforcement; it is labelled synthetic and not represented as generated feasibility.

The former oat-pot assertion applied to every snack, including legitimate pea-protein oats. It now applies only to poultry snacks, preserving its stated ingredient/title fidelity purpose.

Independent review identified a token-switch race in manual queue reload. The bounded follow-up isolates all workspace state per access token and ignores completions after the prior workspace unmounts; the initial request remains abortable. This prevents the prior identity's queue, attestations or messages being displayed while a new identity loads. Targeted lint and nonincremental TypeScript were rerun after this correction.

The static generator's lack of an all-profile macro-fit guarantee is deferred; this plan does not rebuild it. Vegan plant-category scheduling policy remains unchanged and documented by Plan 02. Database gates are still BLOCKED on the unavailable disposable environment and are not replaced by these local tests. Reviewer browser interactions were not performed by this executor; asynchronous state/error handling was checked through code and lint/type gates.

## Commits and scope

No commits or staging, as directed by the parent coordinating a shared checkout. Historical roadmap/state and unrelated files were not changed. The scheduler recency correction was preserved; its prefer-const correction already existed, so no further scheduler edit was needed here.

## Known stubs

None introduced. No mocked data was wired into production UI.

## Self-Check: PASSED

All listed files exist, local result claims match executed commands, and no database verification or production deployment is claimed. Overall Phase 1 completion remains the parent's decision after the separate database gate.
