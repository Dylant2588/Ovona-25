# SCRUM-1 proposed release scope

Prepared 2026-10-30. Review only: no index changes, new commits, history rewrites, pushes, merges or deployment performed.

## Git state observed

The earlier working-tree changes are now in commit `beaef50` (All changes recently), containing 203 changed files. The parent/base is `aeddc80`. The untracked `.release-macro-fix/` is a separate existing checkout and is excluded. This proposal preserves the original commit and extracts selected paths over its parent; it does not rewrite that commit.

## Proposed selection

| Group | Files | Purpose |
| --- | ---: | --- |
| Application/runtime and shared types | 33 | Planner, onboarding, saved preferences, quantities, safety and required nutrition-validation dependencies |
| Tests and test support | 25 | Regression tests for the selected release plus existing schema assertion correction |
| SQL migration source | 1 | Reproducible owner-scoped atomic preference save; already-present function must not be blindly reapplied |
| **Total** | **59** | **144 files excluded from the original commit** |

## Verification

An isolated temporary source tree was created from the parent commit, with only the selected files copied over. Existing installed dependencies were reused through a junction; no dependencies or environment credentials were copied/installed.

- Full test command in that isolated selection: `npm run test:orchestration` — **139 passed, 0 failed, 0 skipped**.
- Isolated TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` — passed.
- Initial isolated run: 138/139; old trusted-planning schema assertion still expected only accepted/eaten, while the existing base migration also permits rejected. Included the already-committed corrected test (rather than skipping or weakening schema checks), then reran all 139 tests successfully.
- The full original working tree previously passed 182 tests. This isolated selection contains fewer tests because unrelated new review/import/coverage feature tests are excluded. No tests present in the isolated source are skipped.
- This verifies test/type dependency completeness; a production Next.js build and authenticated preview smoke test are still required before release.

## Why these dependencies remain

The planner now imports reviewed candidate mapping and nutrition validation, which imports measured-quantity helpers; omitting those files would break compilation or drop checks. Swaps retain protein-family metadata so shared planner behaviour stays consistent. The existing fallback regression harness and schema assertion change are required to keep the retained regression suite accurate.

## Excluded work

All `.planning/` records, screenshots and logs from the original commit; development-server logs; recipe import/review routes and reviewer UI; reviewer lifecycle/access tooling; pending recipe and nutrition datasets; catalogue coverage/preparation commands; unrelated Phase 1/2 migrations and their new tests. The complete included/excluded inventory is in `scrum-1-release-manifest.json`. No `.env` or credentials are selected.

## Exact file list

### Application files

- `frontend-new/app/api/meal-plan/route.ts`
- `frontend-new/app/api/preferences/route.ts`
- `frontend-new/app/meals/page.tsx`
- `frontend-new/app/onboarding/page.tsx`
- `frontend-new/lib/allergy-options.ts`
- `frontend-new/lib/generation/context-builder.ts`
- `frontend-new/lib/generation/generate-plan.ts`
- `frontend-new/lib/generation/previous-plan.ts`
- `frontend-new/lib/ingredient-display.ts`
- `frontend-new/lib/ingredient-ledger.ts`
- `frontend-new/lib/meal-generator.ts`
- `frontend-new/lib/onboarding-preferences.ts`
- `frontend-new/lib/orchestration/candidate-adapter.ts`
- `frontend-new/lib/orchestration/eligibility.ts`
- `frontend-new/lib/orchestration/normalize-profile.ts`
- `frontend-new/lib/orchestration/portions.ts`
- `frontend-new/lib/orchestration/practical-ingredients.ts`
- `frontend-new/lib/orchestration/replace.ts`
- `frontend-new/lib/orchestration/schedule.ts`
- `frontend-new/lib/orchestration/score.ts`
- `frontend-new/lib/orchestration/types.ts`
- `frontend-new/lib/orchestration/validate.ts`
- `frontend-new/lib/plan-preference-snapshot.ts`
- `frontend-new/lib/preference-drafts.ts`
- `frontend-new/lib/preference-feedback.ts`
- `frontend-new/lib/preference-options.ts`
- `frontend-new/lib/preferences-persistence.ts`
- `frontend-new/lib/recipes/candidates.ts`
- `frontend-new/lib/recipes/nutrition.ts`
- `frontend-new/lib/recipes/quantities.ts`
- `frontend-new/lib/recipes/repository.ts`
- `frontend-new/lib/recipes/server-constraints.ts`
- `frontend-new/lib/recipes/types.ts`

### Tests and support

- `frontend-new/scripts/fallback-regression-test.cjs`
- `frontend-new/tests/orchestration/calculated-planning.test.ts`
- `frontend-new/tests/orchestration/calculated-recipe-fixtures.ts`
- `frontend-new/tests/orchestration/context-preferences.test.ts`
- `frontend-new/tests/orchestration/dietary-generation.test.ts`
- `frontend-new/tests/orchestration/food-ranking.test.ts`
- `frontend-new/tests/orchestration/generation-fallback.test.ts`
- `frontend-new/tests/orchestration/ingredient-display.test.ts`
- `frontend-new/tests/orchestration/meal-approval.test.ts`
- `frontend-new/tests/orchestration/meal-variety.test.ts`
- `frontend-new/tests/orchestration/onboarding-preferences.test.ts`
- `frontend-new/tests/orchestration/plan-preference-snapshot.test.ts`
- `frontend-new/tests/orchestration/planning-input.test.ts`
- `frontend-new/tests/orchestration/portions.test.ts`
- `frontend-new/tests/orchestration/practical-ingredients.test.ts`
- `frontend-new/tests/orchestration/preference-drafts.test.ts`
- `frontend-new/tests/orchestration/preference-options.test.ts`
- `frontend-new/tests/orchestration/preference-signature.test.ts`
- `frontend-new/tests/orchestration/preferences-route.test.ts`
- `frontend-new/tests/orchestration/previous-plan.test.ts`
- `frontend-new/tests/orchestration/recipe-nutrition.test.ts`
- `frontend-new/tests/orchestration/replace.test.ts`
- `frontend-new/tests/orchestration/schedule.test.ts`
- `frontend-new/tests/orchestration/trusted-planning-schema.test.ts`
- `frontend-new/tests/orchestration/validate.test.ts`

### Migration source

- `frontend-new/supabase/migrations/20261028091000_baseline_safety_preferences.sql`

## Next step after approval

Prepare a clean release branch based on the verified parent/base, apply only the selected patch, run production build and preview smoke tests, then propose publishing that revision. Recheck the remote production branch before choosing the final base. Do not push the aggregate commit merely to obtain this selection.
