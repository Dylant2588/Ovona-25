---
phase: 02-catalogue-and-nutrition
plan: 03
status: software_verified_locally
subsystem: catalogue-coverage
tags: [nutrition, recipes, scheduling, diagnostics]
requires: [02-01]
provides: [shared-reviewed-candidate-mapping, scheduler-backed-coverage, file-only-coverage-cli]
affects: [02-04]
tech-stack:
  added: []
  patterns: [pure-snapshot-report, shared-production-mapper, explicit-indeterminate-search-budget]
key-files:
  created: [frontend-new/lib/recipes/candidates.ts, frontend-new/lib/recipes/catalogue-coverage.ts, frontend-new/scripts/catalogue-coverage.ts, frontend-new/tests/orchestration/catalogue-coverage.test.ts]
  modified: [frontend-new/lib/orchestration/candidate-adapter.ts]
completed: 2026-10-29
---

# Phase 2 Plan 03: Scheduler-backed catalogue coverage

The production adapter and coverage report now share identical batch-to-serving candidate mapping, and readiness probes distinguish real scheduler success from catalogue counts, source gaps and bounded indeterminate searches.

## Tasks completed

1. Extracted `recipesToCandidates` without changing ingredient division, may-contain expansion, dietary evidence, similarity, protein metadata or neutral unknown pricing. Added pure `reportCatalogueCoverage` using actual repository validation, approval, profile normalization and `orchestrateWeek`.
2. Added explicit file-input CLI and seven diagnostic cohorts, including the restrictive five-meal profile. CLI reads no environment or database, bounds files to 8 MiB / 500 records / 20 cohorts, writes only an explicitly named new output, and refuses input replacement.

## Evidence and behavior

- Catalogue classifications retain version-row counts and separate unique recipe IDs; repeated slot appearances never inflate unique slot capacity. Multiple approved versions are explicitly listed.
- Duplicate snack slots produce daily demand 2 and weekly demand 14.
- Compatibility probes label legacy reviewed nutrition honestly; calculated-only probes exclude it.
- Malformed approved records block readiness exactly as the production library loader does, rather than silently passing a cleaned subset.
- Feasible means the actual scheduler returned seven days; representative plans are included only on success. Slot presence with impossible nutrition fails.
- A deterministic 20,000 daily-combination budget returns `indeterminate`, with no candidate truncation and no claim of proven infeasibility.
- Vegan three/five-meal broad plant-type cap remains a visible policy gap; scheduler guards were not changed.

## Validation actually run

- RED: new test file failed because candidate/coverage modules did not exist.
- Focused combined command: `node --test tests/orchestration/catalogue-coverage.test.ts tests/orchestration/planning-input.test.ts tests/orchestration/dietary-generation.test.ts` — 25/25 passed before the final malformed-approved regression was added.
- Final focused command: `node --test tests/orchestration/catalogue-coverage.test.ts` — 9/9 passed, zero skips, 774 ms. Includes two deterministic actual CLI executions and invalid CLI/input-overwrite checks.
- `npx tsc --noEmit --incremental false` — passed.
- Focused ESLint on all five owned source/test files — zero errors/warnings. Existing baseline-browser-mapping age notice appeared; no dependency was installed.

Synthetic fixtures demonstrate software behavior only, never actual food composition or real reviewed catalogue coverage. Parent Plan 04 will run the report against the sourced pending snapshot and the integrated gates.

## Deviations

[Rule 2 — Correctness] Added malformed-approved whole-library blocking to match `loadReviewedRecipes` semantics; otherwise an invalid runtime catalogue could receive a false readiness pass.

[Rule 2 — Resource safety] Added explicit deterministic search-space admission instead of an unenforceable synchronous timeout. Budget rejection is reported as indeterminate and does not alter production scheduling.

No commits or global/historical STATE edits were made, following the parent instruction to preserve the shared dirty working tree. No database access, schema changes or live writes occurred.

## Known limitations

The 20,000-combination budget is a diagnostic runtime bound, not a feasibility theorem. Some large real catalogues may need a separately bounded worker probe later. Multiple approved versions remain an explicit diagnostic warning; this plan preserves production mapping behavior and does not choose or rewrite versions.

## Self-Check: PASSED

All five owned source/test files and this summary exist. Focused tests, TypeScript and lint passed. No new endpoint, credential handling, migration or network surface was introduced.
