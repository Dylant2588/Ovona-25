---
phase: 01-trustworthy-baseline
plan: "02"
subsystem: dietary-admission
status: implemented-with-documented-policy-gap
tags: [preferences, safety, dietary, orchestration]
requires: []
provides: [canonical-effective-restrictions, reviewed-dietary-evidence]
affects: [context-builder, candidate-adapter, recipe-approval-boundary]
tech-stack:
  added: []
  patterns: [shared-pure-constraint-merger, injected-database-tests]
key-files:
  created: [frontend-new/tests/orchestration/dietary-generation.test.ts]
  modified: [frontend-new/lib/recipes/server-constraints.ts, frontend-new/lib/generation/context-builder.ts, frontend-new/lib/orchestration/candidate-adapter.ts, frontend-new/tests/orchestration/planning-input.test.ts]
metrics:
  completed: 2026-10-28
  tasks: 2
requirements: [BASE-04, BASE-07]
---

# Phase 1 Plan 02: Canonical restrictions and evidenced dietary admission

Saved restrictions now remain authoritative through context construction, recipe admission, candidate evidence and the existing final approval boundary. The adapter no longer drops dietary evidence before scheduler eligibility.

## Changes

- `mergeEffectiveConstraints()` canonicalises recognised allergy/diet aliases, retains unknown terms for fail-closed recipe approval, unions every restriction group, and selects the strictest finite positive preparation limit.
- `constraintsFromSources()` reads profile/preferences/allergy-table evidence plus requested additions. Malformed stores and unavailable safety reads reject planning instead of yielding an unrestricted profile. Requested never-foods and preparation limits now participate.
- `buildContext()` uses this same merger. A requested Mixed mode cannot replace saved vegan/vegetarian rules; profile never-foods survive. An already-loaded constraint set can be passed into context construction. Removed duplicate permissive allergy/diet parsing.
- The adapter merges context/brief restrictions with saved server constraints rather than selecting one branch. Returned context/AI brief carries the effective union too.
- Candidate dietary tags are emitted only for the effective rules already proven by `approveRecipe()`. Allergen evidence includes `mayContain` and uses canonical names. Generic eligibility and scheduler guards remain unchanged.
- Direct Node tests use relative runtime imports and lazy server-client loading in context-builder; no new framework, dependency or configuration is needed.

## Test-first evidence

Before implementation, the new server-union tests failed because aliases stayed raw, requested never-food/prep additions were absent, and invalid preparation data was ignored. The new direct context test initially also exposed alias-only runtime imports, corrected without changing application configuration.

After implementation:

| Command (cwd frontend-new) | Result |
|---|---|
| `node --test tests/orchestration/dietary-generation.test.ts tests/orchestration/planning-input.test.ts tests/orchestration/generation-adapter.test.ts tests/orchestration/eligibility.test.ts tests/orchestration/meal-approval-integration.test.ts` | 27 passed, 0 failed, 0 skipped |
| `.\node_modules\.bin\tsc.cmd --noEmit --incremental false` | Exit 0, no diagnostics |
| `.\node_modules\.bin\eslint.cmd lib/recipes/server-constraints.ts lib/generation/context-builder.ts lib/orchestration/candidate-adapter.ts tests/orchestration/dietary-generation.test.ts tests/orchestration/planning-input.test.ts --no-cache` | Exit 0; only installed baseline-browser-mapping data notice |
| `git diff --check` restricted to owned files | Exit 0 |

The matrix exercises Mixed, vegetarian, vegan, pescatarian, pescetarian alias, low-carb, high-protein, combined saved/requested dietary rules, saved allergy and never-food restrictions, stricter prep, cross-contact exclusion and retained non-conflicting cross-contact evidence. Feasible three-meal profiles produce seven days; a feasible unrestricted five-meal profile retains two distinct snacks. Existing persistence-boundary and adapter tests continue to pass. Full-suite baseline reconciliation belongs to Plan 04.

## Important existing policy gap

The scheduler caps a `proteinType` at two meals/day. Honest vegan catalogue records classify their protein as `plant`; thus an all-plant three- or five-meal day cannot satisfy that existing scheduler rule. **Vegan reviewed candidates now pass actual adapter and eligibility admission, but complete vegan scheduling is not claimed.** Its test asserts the current typed insufficiency rather than inventing animal/mixed metadata or weakening the cap. Vegetarian five-meal coverage can face a related limitation because plant/mixed are the only suitable broad categories. The parent explicitly directed preservation of this guard and separate follow-up for precise protein-source metadata/policy. No scheduler changes were made.

## Deviations

- The plan's universally successful diet scheduling matrix was corrected to distinguish repaired admission from the pre-existing protein-category policy gap. Feasible diet profiles still prove full seven-day scheduling with accurate metadata.
- No commits or shared state/roadmap changes: parent orchestrator owns coordination in the shared checkout. Existing unrelated work and the verified recency correction were preserved.

## Database and security evidence

No live database reads/writes, migration changes or external API calls were performed. Tests inject database responses and execute production functions. Real database/RLS evidence remains Plan 05, not established by these tests. No new network endpoints or privileged access were added. Unknown restrictions remain present and prevent recipe admission; dislikes remain soft.

## Known Stubs

None added. The typed insufficiency for the documented vegan scheduler-policy gap is existing behaviour, not a placeholder or claimed success.

## Self-Check: PASSED

All five owned implementation/test files and this summary exist. Local checks above completed successfully. No commit hashes are claimed because the parent explicitly prohibited staging/commits. BASE-04 admission is implemented; full vegan scheduling remains the documented separate policy gap.
