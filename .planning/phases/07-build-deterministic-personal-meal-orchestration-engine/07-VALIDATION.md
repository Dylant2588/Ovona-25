---
phase: 07
slug: build-deterministic-personal-meal-orchestration-engine
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-10
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (Node 24) |
| **Config file** | None — Plan 07-01 Task 1 adds `test:orchestration` and any needed TypeScript test bootstrap |
| **Quick run command** | `npm run test:orchestration` |
| **Full suite command** | `npm run test:orchestration && node scripts/fallback-regression-test.cjs && npm run lint` |
| **Estimated runtime** | ~30 seconds |

## Sampling Rate

- **After every task commit:** Run the relevant orchestration test file and `npm run lint` in `frontend-new`.
- **After every plan wave:** Run `npm run test:orchestration`, `node scripts/fallback-regression-test.cjs`, and `npm run lint`.
- **Before `/gsd-verify-work`:** Full suite must be green and a manual generate → swap → shopping smoke must show seven days.
- **Max feedback latency:** 30 seconds.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File State | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|------------|--------|
| 07-01-01 | 01 | 1 | D-12 | T-07-04 | Fixture exports make safe, unsafe, incomplete, leftover, alias, cost, pantry, nutrition, and quantity facts discoverable without nondeterminism. | unit | `npm run test:orchestration -- tests/orchestration/fixtures.test.ts` | Created by this task | ⬜ pending |
| 07-01-02 | 01 | 1 | D-01, D-02, D-03 | T-07-01 | Non-finite/out-of-policy profile values are typed failures; valid profiles retain canonical household size. | unit | `npm run test:orchestration -- tests/orchestration/normalize-profile.test.ts` | Created by this task | ⬜ pending |
| 07-01-03 | 01 | 1 | D-02, D-10, D-12 | T-07-02, T-07-04 | Incomplete, unverified, allergy-unsafe, or diet-unsafe candidates cannot enter deterministic scoring. | unit | `npm run test:orchestration -- tests/orchestration/eligibility.test.ts` | Created by this task | ⬜ pending |
| 07-02-01 | 02 | 2 | D-04, D-05, D-06, D-09, D-10, D-12 | T-07-04 | Stable score/tie-break logic produces a seven-day schedule, factual reasons, and only declared leftover repetition. | unit | `npm run test:orchestration -- tests/orchestration/schedule.test.ts` | Created by this task | ⬜ pending |
| 07-02-02 | 02 | 2 | D-02, D-03, D-07, D-10, D-12 | T-07-02 | Validation is bounded and safe; selected meals materialize `servings` from recipe servings → nutrition portion → household multiplier exactly once. | unit | `npm run test:orchestration -- tests/orchestration/validate.test.ts tests/orchestration/schedule.test.ts` | Created by this task | ⬜ pending |
| 07-03-01 | 03 | 3 | D-02, D-06, D-08, D-09, D-12 | T-07-01, T-07-04 | A swap changes only its target slot, keeps hard constraints, and exposes a score-derived reason. | unit | `npm run test:orchestration -- tests/orchestration/replace.test.ts` | Created by this task | ⬜ pending |
| 07-03-02 | 03 | 3 | D-03, D-04, D-11, D-12 | T-07-02 | Seven-day shopping consumes materialized `servings`, merges aliases, splits pantry, and never applies household size twice. | unit | `npm run test:orchestration -- tests/orchestration/shopping.test.ts` | Created by this task | ⬜ pending |
| 07-04-01 | 04 | 4 | D-01, D-02, D-04, D-06, D-07, D-10, D-12 | T-07-01–T-07-04 | Verified catalogue hydration proves seven-day capacity or returns typed insufficiency without LLM safety inference. | integration | `npm run test:orchestration -- tests/orchestration/generation-adapter.test.ts` | Extended by this task | ⬜ pending |
| 07-04-02 | 04 | 4 | D-04, D-05, D-06, D-07, D-09, D-10, D-12 | T-07-04 | Generation and fallback compatibility paths preserve seven days and defer final selection/validation to the pure core. | regression | `npm run test:orchestration -- tests/orchestration/generation-adapter.test.ts && node scripts/fallback-regression-test.cjs` | Extended by this task | ⬜ pending |
| 07-05-01 | 05 | 5 | D-01, D-02, D-04, D-12 | T-07-01–T-07-03 | Generation and state routes are authenticated, user-scoped, and persist/reload seven dated days. | integration | `npm run test:orchestration -- tests/orchestration/routes.test.ts` | Created by this task | ⬜ pending |
| 07-05-02 | 05 | 5 | D-02, D-03, D-08, D-11, D-12 | T-07-01–T-07-04 | Swap uses authenticated hydrated input; shopping persists all days from materialized servings with no route-level household scaling. | integration | `npm run test:orchestration -- tests/orchestration/routes.test.ts && node scripts/fallback-regression-test.cjs` | Extended by this task | ⬜ pending |
| 07-05-03 | 05 | 5 | D-04, D-09 | T-07-02 | Existing planner renders the seven-day response, one weekly action, and factual meal reasons without breaking route consumption. | UI regression | `npm run lint && npm run test:orchestration -- tests/orchestration/routes.test.ts` | Existing page modified by task | ⬜ pending |

## Test-Bootstrap State

There is **no separate Wave 0 plan**. `wave_0_complete: false` means the test scaffold does not yet exist; it is deliberately created first by 07-01-01 in Wave 1 before any production-core task. That task creates the package command, deterministic fixture module, and fixture discovery test. Every later row depends directly or transitively on 07-01 and therefore must use the command it establishes.

- [ ] 07-01-01 creates `frontend-new/tests/orchestration/fixtures.ts` with fully materialized safe/unsafe candidates, leftovers, aliases, costs, pantry flags, and quantities.
- [ ] 07-01-01 creates `frontend-new/tests/orchestration/fixtures.test.ts` and `frontend-new/package.json` `test:orchestration` command.
- [ ] 07-01-02 through 07-05-02 create or extend the named deterministic test files in the table above; 07-05-03 uses the established route harness plus lint for UI-consumption regression.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|------------------|
| “Just plan my week” is understandable and explanations are useful in the existing planner UI | D-04, D-09 | Copy and presentation need human product review | Generate a plan for a seeded profile; confirm all seven days render and one explanation mentions a score-derived reason. |

## Validation Sign-Off

- [x] All 12 planned tasks have a mapped automated verification command; 07-01-01 supplies the missing test bootstrap before later test tasks run.
- [x] Sampling continuity has no three consecutive tasks without automated verification.
- [x] Test-bootstrap state and every future test-file dependency are explicit.
- [x] No watch-mode flags are used.
- [x] Feedback latency target is under 30 seconds.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending execution
