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
| **Config file** | None — Wave 0 adds a package script and test bootstrap if TypeScript import support needs one |
| **Quick run command** | `node --test tests/orchestration/**/*.test.ts` |
| **Full suite command** | `node --test tests/orchestration/**/*.test.ts && node scripts/fallback-regression-test.cjs && npm run lint` |
| **Estimated runtime** | ~30 seconds |

## Sampling Rate

- **After every task commit:** Run the relevant orchestration test file and `npm run lint` in `frontend-new`.
- **After every plan wave:** Run `node --test tests/orchestration/**/*.test.ts`, `node scripts/fallback-regression-test.cjs`, and `npm run lint`.
- **Before `/gsd-verify-work`:** Full suite must be green and a manual generate → swap → shopping smoke must show seven days.
- **Max feedback latency:** 30 seconds.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | D-12 | T-07-01 | Unsafe allergy/dietary candidates are excluded before scoring and after swaps | unit | `node --test tests/orchestration/eligibility.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | D-12 | T-07-02 | Non-finite/out-of-range profile values are rejected or normalized at the boundary | unit | `node --test tests/orchestration/normalize-profile.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | D-04–D-07 | T-07-03 | Stable scoring produces a seven-day schedule within target bands or explicit violations | unit | `node --test tests/orchestration/schedule.test.ts tests/orchestration/validate.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 3 | D-08–D-09 | T-07-01 | A swap changes only its target slot, keeps hard constraints, and preserves all other slots | unit | `node --test tests/orchestration/replace.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 3 | D-11 | T-07-02 | Household scaling occurs once, duplicate ingredients merge, and pantry staples are split | unit | `node --test tests/orchestration/shopping.test.ts` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 4 | D-04, D-08, D-11 | T-07-04 | Authenticated API generation, swap, and shopping paths keep user scoping and seven-day output | integration | `npm run lint` plus deterministic route harness | ❌ W0 | ⬜ pending |

## Wave 0 Requirements

- [ ] `frontend-new/tests/orchestration/fixtures.ts` — fully materialized safe/unsafe candidates, leftovers, aliases, costs, and quantities.
- [ ] `frontend-new/tests/orchestration/*.test.ts` — Node test-runner coverage for the locked D-12 behaviours.
- [ ] `frontend-new/package.json` — non-watch test command that discovers the new tests.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|------------------|
| “Just plan my week” is understandable and explanations are useful in the existing planner UI | D-04, D-09 | Copy and presentation need human product review | Generate a plan for a seeded profile; confirm all seven days render and one explanation mentions a score-derived reason. |

## Validation Sign-Off

- [x] All tasks have automated verification or Wave 0 dependencies.
- [x] Sampling continuity has no three consecutive tasks without automated verification.
- [x] Wave 0 covers every missing test reference.
- [x] No watch-mode flags are used.
- [x] Feedback latency target is under 30 seconds.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending execution
