---
phase: quick-261104-dwi
plan: 01
subsystem: dietary-approval
tags: [SCRUM-11, OV-03, dietary-safety, shopping, retailer]
requires: [reviewed-recipe-approval, saved-safety-preferences, ingredient-ledger]
provides: [shared-exclusion-policy, shopping-approval-boundary, retailer-suitability-state]
affects: [meal-generation, swaps, shopping-list, retailer-comparison]
tech-stack:
  added: []
  patterns: [shared-reviewed-policy, server-revalidation, fail-closed-evidence]
key-files:
  modified: [frontend-new/lib/recipes/taxonomy.ts, frontend-new/lib/recipes/approval.ts, frontend-new/lib/retailer-comparison.ts, frontend-new/lib/retailer-observation-adapters.ts, frontend-new/app/api/shopping-list/route.ts]
decisions:
  - Reuse reviewed recipe approval and one saved-constraint snapshot at shopping boundaries.
  - Keep price qualification separate from dietary verification.
  - Do not add schema columns or invent product evidence for existing price observations.
completed: 2026-11-04
---

# SCRUM-11: Hard dietary restriction enforcement

Reviewed recipe approval now recognizes defined milk derivatives, shopping endpoints reapprove recipes against current saved restrictions, and retailer comparison explicitly separates verified dietary evidence from prices.

## Work completed

1. Extended the existing exact taxonomy for whey, casein and caseinates while preserving canonical IDs. Advanced the approval-policy version to `2026-11-04.1`. Shared hard-exclusion matching between recipe and product checks; unknown and incomplete evidence stays rejected/unverified.
2. Extended the existing retailer observation/comparator contract with optional reviewed suitability evidence. Allergen conflicts, derivatives, dietary conflicts and never-food exclusions are checked before price ranking. Missing/malformed evidence cannot qualify restricted baskets. Unrestricted price-only comparisons remain possible with explicit `dietaryStatus: unverified`. Operator imports preserve valid optional evidence and reject malformed declarations.
3. Shopping GET and POST now invoke existing `approvePlanForUser` before constructing quantities. The same server-loaded restriction snapshot is passed into recipe approval and product comparison. Shape, owner and complete-week checks remain; neither endpoint writes a shopping cache or changes an active plan on rejection.
4. Parent orchestrator added a client projection guard so the local shopping list is shown only after server approval of the same plan/preference/session snapshot. This closes the presentation gap found during review without changing ingredient arithmetic.

## Verification

- RED/GREEN: derivative regression failed before taxonomy change and passed after it; retailer suitability regressions failed before comparator change and passed after it; shopping boundary regression failed before approval wiring and passed after it.
- Core complete orchestration suite outside network sandbox: **206 passed, 0 failed, 0 skipped** (before final parent UI changes).
- Focused shared recipe and retailer regressions after exclusion-helper reuse: **13 passed**.
- Initial sandbox-only redirect-test failure was environmental: the isolated suite passed all four tests with local HTTP permitted. No failure was skipped or unrelated import code changed.
- Final combined UI/core suite, lint and typecheck results are recorded by the parent orchestrator after its UI changes. A concurrent intermediate typecheck ran while those edits were incomplete and must not be treated as final verification.

## Acceptance evidence

| Criterion | Evidence |
|---|---|
| AC1 Persist/retrieve restrictions | Existing preferences owner-RPC tests, planning-input union tests, new safety-patch roundtrip test for allergies/exclusions/diet. No live database mutation was used. |
| AC2 Ingredients and derivatives | Existing milk/egg evidence tests plus new whey/casein/caseinate taxonomy regressions; shared never-food matcher. |
| AC3 Swaps/substitutions | Existing unsafe-replacement tests and generation admission through `approveRecipe`; state/swap approval boundaries remain authoritative; changed ingredient/version/method tests deny forged meals. |
| AC4 Product mapping checks | New comparator regression excludes cheaper conflicting product before ranking and rejects dietary and hard-exclusion conflicts. Shopping forwards server constraints. |
| AC5 Unknown allergen evidence | New missing/malformed evidence tests produce explicit unverified state and unavailable restricted comparison. |
| AC6 No automatic relaxation | Existing saved/request union and no-suitable-candidate tests, plus new saved-exclusion zero-write test. |
| AC7 Understandable failure | Existing `approvalFailure`/reason-coded recipe messages reused for shopping failures; no suitable recipes fail closed with existing planner insufficiency reasons. |
| AC8 Server enforcement | Real recipe-boundary integration inside actual shopping route harness rejects tampered and currently excluded plans for GET/POST; test asserts one constraint snapshot and zero writes. |

## Commits

- `1309721` test: reviewed milk derivative restrictions (RED).
- `065b3c1` fix: reviewed milk derivative taxonomy (GREEN).
- `d39a821` test: retailer suitability evidence (RED).
- `1ce7274` test: shopping dietary approval (RED).
- `6a7afbe` test/policy: saved safety restriction roundtrip and zero-write rejection.
- `0c43145` fix: retailer suitability evidence validation.
- `0240d89` fix: shopping server approval and shared constraint snapshot.
- Shared exclusion follow-up and scoped UI commits recorded by parent orchestrator.

## Deviations and remaining risks

- Review found the client independently displayed its local ingredient ledger even when server shopping approval failed. Parent added a scoped display guard and tests; otherwise the server-only fix would leave a misleading stale basket visible.
- Product discovery and a real reviewed product catalogue remain OV-08 scope. Existing database price observations contain no product suitability metadata, so constrained retailer comparisons correctly remain unavailable/unverified. No database columns or dependencies were added.
- Safety evidence is exact reviewed taxonomy and structured metadata, not a medical guarantee or inference from retailer price provenance. Unknown/composite products require reviewed evidence.
- Live Supabase preference RPC deployment was not retested or migrated; existing compatibility-safe persistence behavior is preserved and deterministic fixtures verify application boundaries.
- Previously dirty SCRUM-7/SCRUM-8 UI work and unrelated planning/debug files were preserved and excluded from this executor's commits. Nothing was deployed or merged.

## Known Stubs

None added. Missing retailer evidence is an explicit unverified result, not fabricated product data.

## Self-Check: PASSED

Plan and summary exist. All seven recorded commits were verified through `git log`. Scoped source/tests exist; final combined verification remains the orchestrator's responsibility after its UI work.

## Final combined verification

- Full orchestration suite: 207 passed, zero failed, zero skipped, with local-network access for the existing redirect test.
- TypeScript: `npx tsc --noEmit --incremental false` passed after correcting an optional owner ID in the new fixture; its targeted test also passed again.
- Lint: zero errors, nine warnings (hook/dependency and unused-code warnings remain).
- Final safety commit: `70d37e2`, including the shared canonical exclusion helper and isolated UI approval hunks. Existing shopping redesign changes remain outside this commit.
- Browser shopping projection requires the exact currently approved plan and preference snapshots, and invalidates on swaps, preference changes, authentication changes and failed approval. Server failure details appear outside the hidden basket with a retry action.
- Live browser smoke and live Supabase persistence were not rerun; validation uses real approval boundaries with deterministic database fixtures. No deployment or merge performed. Ready for owner review.
