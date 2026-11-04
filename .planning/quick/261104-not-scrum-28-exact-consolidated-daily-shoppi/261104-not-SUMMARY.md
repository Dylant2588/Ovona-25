---
phase: quick-261104-not
plan: 01
subsystem: shopping
tags: [daily-mvp, ingredient-ledger, provenance, accessibility]
requires: [SCRUM-25, SCRUM-11]
provides: [stable-recipe-source-identity, daily-shopping-regressions, visible-shopping-states]
affects: [SCRUM-29, SCRUM-30]
tech-stack:
  added: []
  patterns: [shared-final-ingredient-ledger, exact-snapshot-approval, recipe-version-provenance]
key-files:
  created:
    - frontend-new/tests/orchestration/daily-shopping.test.ts
    - frontend-new/components/ShoppingRecipeSources.tsx
    - frontend-new/lib/shopping-departments.ts
    - frontend-new/tests/orchestration/shopping-departments.test.ts
  modified:
    - frontend-new/lib/shopping-provenance.ts
    - frontend-new/tests/orchestration/shopping-provenance.test.ts
    - frontend-new/app/meals/page.tsx
completed: 2026-11-04
---

# SCRUM-28: Exact approved daily shopping requirements

The existing final ingredient ledger remains authoritative; daily shopping now preserves stable recipe/version provenance, department grouping and readable exact requirements, with visible verification and genuine empty states.

## Tasks and commits

1. `e3ad090` — RED regression for same-title different recipe/version sources, plus daily five-contribution aggregation and swap/reload tests.
2. `1d50cb7` — Group known sources by recipe ID and version, retain a distinct title-only fallback for legacy sources, and use the same identity for React keys. Adopt the existing authorised recipe-source reveal/inline component.
3. `c327bc8` — Adopt prior authorised department grouping and source-display page changes; expose verification status outside the hidden approved-list conditional, show genuine all-social no-requirements state, remove duplicate unreachable inner errors/loading, and label amounts as recipe requirements before pack rounding.

## Verification

- Targeted daily ledger/provenance, SI/form/rounding, approval/revision and department suites: 28 passed.
- Complete orchestration suite: **230 passed, zero failed, zero skipped** with local HTTP access for the existing redirect test.
- TypeScript `npx tsc --noEmit --incremental false`: passed.
- ESLint: zero errors, nine existing warnings.
- Parent browser test at 390×844: 17 current daily shopping items grouped by department; recipe-requirement caption visible; 262g chicken contribution across two meals expanded by tapping its accessible source label to reveal Herbed Chicken Rice Plate and Chicken & Cucumber Snack Box. Evidence: `shopping-mobile-proof.png`. Temporary viewport was reset; no new user data writes.
- SCRUM-25 already verified actual daily save, swap and reload. Added tests prove a swapped daily ingredient/reference disappears and the reloaded current ledger equals its source contributions.

## Acceptance evidence

| Criterion | Evidence |
|---|---|
| Approved daily requirements from current portions | Existing shared ledger and authenticated scope-aware shopping boundaries preserved; daily builder regression |
| Compatible units and distinct food forms | g/kg, ml/L and fresh/tinned fixtures; existing form/alias regressions |
| Exact internals and readable display | 14.1725g remains exact internally and displays 14g; small positive quantities retained; no second serving scaling |
| Departments and Used in | Existing department/source UI reused; stable source identity prevents title collisions; mobile disclosure verified |
| Swap/reload consistency | Current contribution and source maps match after serialization; obsolete ingredient/source removed; existing scope/revision regressions |
| No unapproved or stale basket | Existing exact-plan/preference/auth guard and server approval regressions preserved |
| Clear loading, rejection and empty states | Verification status and existing retry/error outside the hidden list; genuine all-social requirements explicitly empty |

## Decisions and deviations

- Reused prior authorised SCRUM-7/8 work because department grouping and recipe-source display are explicit SCRUM-28 requirements. Full page diff was inspected before adoption; no unrelated page work or private snapshots were staged. SCRUM-7/8 statuses were not changed.
- No ledger arithmetic or canonical model was replaced. Coarse taxonomy IDs must not merge milk/yogurt, fresh/tinned or raw/cooked forms; existing curated compatible aliases remain in use.
- Stable identities are optional for legacy compatibility. Identified sources never merge into unidentified same-title records.
- Parent owns STATE, metadata commit and Jira review transition under the quick workflow.

## Known stubs and remaining risks

No stubs prevent this shopping requirement flow. Pricing remains explicitly unavailable in the reused list until fresh qualified data exists; approximate purchase costs and pack rounding are SCRUM-29 scope, separate from recipe quantities. No new dependency, schema, live recipe write, network endpoint, merge or deployment was introduced.

## Self-Check: PASSED

All listed source/test files and the summary exist. Commits `e3ad090`, `1d50cb7` and `c327bc8` are verified in Git history. All checks passed as recorded above.
