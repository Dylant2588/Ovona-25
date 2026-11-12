---
phase: quick-261112-h8v
reviewed: 2026-11-12T13:04:06Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - frontend-new/lib/orchestration/portions.ts
  - frontend-new/lib/orchestration/practical-ingredients.ts
  - frontend-new/lib/orchestration/replace.ts
  - frontend-new/lib/orchestration/schedule.ts
  - frontend-new/tests/orchestration/generation-fallback.test.ts
  - frontend-new/tests/orchestration/portions.test.ts
  - frontend-new/tests/orchestration/replace.test.ts
  - frontend-new/tests/orchestration/schedule.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# SCRUM-35 code review

Reviewed the eight source/test paths changed from `0ed0ab5`, including the four-line narrower-interval relaxed-bound precheck in the working copy of `portions.ts` following `c426f51`. No correctness, security or test-reliability findings were identified. No application files were changed by this review.

## Checks performed

- Traced the portion solver's original continuous and individually rounded calorie/protein checks, finite custom bounds, exact-target attempt, verified fallback, finite tightening and rounding-threshold polish. Fixed surrounding portions remain fixed, and failed tighter projections do not remove a verified fallback.
- Checked the narrower calorie-interval prechecks against the existing continuous-knapsack relaxation: they reject only when the relaxed upper bound cannot meet the requested lower bound. Zero-margin attempts remain available.
- Traced shared and independent portions into complete schedule validation. Shared scaling checks both continuous and rounded totals; final incumbents also verify finite 0.7–1.5 portions and exact serving materialisation. The previously identified 1.500001 rounding/repair edge case has an explicit rejection regression.
- Checked complete-incumbent ownership, sum-of-daily absolute calorie deviation before soft scores, stable tie handling, node/deadline cutoffs and preservation of an existing incumbent. No partial schedule becomes an accepted result. The optional improvement allocation remains inside the existing overall search limits.
- Checked target-only replacement bounds, practical allowances accounting for unchanged days, protein-family admission and positional object-identity preservation, including both snack occurrences. Existing source meals are not mutated.
- Cross-referenced generation materialisation, final recipe approval and the unchanged policy bands. The new runtime regression exercises actual day/week generation and final approval with controlled dependencies; it verifies rounded macros, portion bounds and exact scaled ingredient amounts.
- Inspected the added assertions for exact-target examples, protein-constrained fallback, immutable replacements, daily errors that cannot cancel in a weekly total, and deterministic controlled search cutoffs.

## Scope and limitations

- This is a Codex GSD review, not an independent Claude Code review.
- Search and projection remain bounded heuristics. This review does not certify a globally closest plan, universal exact calorie matching, or catalogue sufficiency. A feasible fixture can still miss its nominal goal within the unchanged acceptance band.
- `orchestration/replace.ts` is a helper. The production swap route continues to use generation plus macro enforcement; helper tests are not represented as complete browser or production swap-route coverage.
- No authenticated browser, live database or catalogue writes were performed. Full-suite, TypeScript and lint results belong to the executor's verification evidence and were not independently rerun here.
- Existing pending SCRUM-29 browser acceptance, micronutrient/source-evidence gaps and the tofu/pea-protein-excluded catalogue shortfall remain outside this review's completion claim.

_Reviewer: Codex GSD code reviewer_
