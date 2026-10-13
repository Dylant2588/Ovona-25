---
phase: 08-build-trusted-ai-meal-generation-rotation-memory-and-budget-
plan: "01"
subsystem: database
tags: [supabase, postgres, rls, recipes, retailer-pricing]
requires:
  - phase: 07
    provides: reviewed recipe-library boundary
provides:
  - reviewed-recipe import audit and version transition contracts
  - fourteen-day recipe identity fields on meal history
  - service-only retailer observation evidence storage
affects: [08-02, 08-03, recipe-library]
tech-stack:
  added: []
  patterns: [fail-closed recipe imports, operator-imported retailer feeds]
key-files:
  created:
    - frontend-new/supabase/migrations/20261013_trusted_planning_evidence.sql
    - frontend-new/lib/recipes/imports.ts
    - frontend-new/lib/retailer-observation-adapters.ts
  modified:
    - frontend-new/lib/recipes/repository.ts
key-decisions:
  - "Imported records always begin pending review; approval creates a new version."
  - "Retailer observations accept only complete operator-imported feed batches and expose no fetch or scraping path."
patterns-established:
  - "Operational evidence tables revoke all anon/authenticated access and rely on service-role writes."
requirements-completed: []
duration: 10min
completed: 2026-10-13
---

# Phase 08 Plan 01: Trusted Evidence Contracts Summary

**Additive, RLS-protected evidence storage and fail-closed import helpers prevent unreviewed recipes or unprovenanced retailer prices from entering planning.**

## Accomplishments

- Added idempotent schema for recipe import audits, retailer observations, and recipe-aware fourteen-day meal history.
- Added pure import/review transitions that require complete evidence and create a new approved version.
- Added operator feed validation with no runtime price-scraping implementation, and strengthened reviewed-library row consistency checks.

## Task Commits

1. **Task 1: Define trusted evidence and rotation schema** — `1d51e1a`
2. **Task 2: Add a fail-closed trusted-source import and review transition helper** — `0d84c29`

## Verification

- Passed: `node --test tests/orchestration/recipe-library.test.ts tests/orchestration/recipe-imports.test.ts tests/orchestration/trusted-planning-schema.test.ts` (8/8).
- Passed: `npx tsc --noEmit`.
- Passed: `npm run lint` with 0 errors and 7 pre-existing warnings in `app/meals/page.tsx` and `lib/INTEGRATION.ts`.
- Not run: `supabase db reset --local` and `supabase test db`; the Supabase CLI is not installed (`supabase` is not recognized).

## Deployment Checkpoint

Hosted deployment is blocked pending Supabase credentials and confirmation that the linked project is intended. From `frontend-new`, run:

```powershell
supabase link --project-ref <approved-project-ref>
supabase db push --linked
supabase migration list --linked
supabase test db
```

Then verify migration `20261013_trusted_planning_evidence.sql`, the `recipe_imports` and `retailer_price_observations` tables, `user_meal_history` identity/state columns and index, RLS enabled state and policies, and that anon/authenticated have no operational-evidence mutation grants.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the existing repository test fixture for the newly selected review-status column.**
- **Found during:** Task 2
- **Fix:** Added `review_status: "approved"` to valid fixture rows so the strengthened fail-closed repository contract is tested accurately.

## Known Stubs

None.

## Self-Check: PASSED

- Created files exist and task commits `1d51e1a` and `0d84c29` are present in git history.
