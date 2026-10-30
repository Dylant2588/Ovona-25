# Phase 2: Catalogue and nutrition

Authorised 2026-10-29 by the user's “let’s do it” following the scoped Phase 2 description. Use this directory and `.planning/mvp-reset/ROADMAP.md`, never the historical phase 2.

## Goal and locked decisions

Precise ingredient quantities, units and servings; reproducible nutrition calculated from ingredient evidence; explicit reviewed catalogue coverage and gaps for dietary restrictions, preparation limits and weekly variety. Preserve Next.js/Supabase stack and reuse existing recipes, immutable review transitions, scheduler and allergy gates.

Ingredients remain whole-recipe quantities; recipe macros remain per serving. Food nutrient identity must be separate from broad allergen/diet taxonomy identity, with explicit preparation state and source/version. Missing quantities, ambiguous units, incomplete nutrients or missing source evidence must fail closed rather than estimate silently. Existing reviewed records must not be silently rewritten or falsely relabelled as calculated. New and corrected content uses pending versions and existing review workflow. Never fabricate source rights, cooked attestations, or measured nutrition.

## Requirements

- CAT-01: Validate finite positive ingredient quantities and servings; exact mass/volume/count conversions require explicit ingredient evidence, with tests for unknown, ambiguous and incompatible units.
- CAT-02: Calculate whole-batch and per-serving calories/protein/carbs/fat deterministically from complete versioned ingredient food records; preserve calculation inputs/provenance and detect stale/tampered outputs.
- CAT-03: Integrate calculation validation into import/review/planner boundaries for the new calculated method; retain honest compatibility for existing legacy measured evidence, without automatic promotion.
- CAT-04: Provide a reproducible catalogue coverage report using actual approval and scheduler constraints; distinguish raw counts from proven feasible plans and produce actionable missing-data/coverage gaps.
- CAT-05: Prepare reviewable catalogue improvements from real source data where available; explicitly report any remaining human cook-through/source-rights review work. Never declare reviewed coverage complete based on synthetic fixtures.
- CAT-06: Regression tests, TypeScript/lint and appropriate disposable database verification pass; no live database writes, application repointing, dependency installation or deployment.

## Boundaries

Phase 1 browser checks are being completed alongside research. Saved-plan/shopping revisions are Phase 3; AI adaptation Phase 4; products/pricing Phase 5. No broad UI redesign. Revisit the pre-existing plant protein category cap only if necessary for truthful catalogue feasibility, with explicit policy and regression evidence; do not weaken allergen, portion or macro guards.

## Canonical references

- `.planning/mvp-reset/ROADMAP.md`
- `.planning/mvp-reset/REQUIREMENTS.md`
- `.planning/mvp-reset/phases/01-trustworthy-baseline/01-VERIFICATION.md`
- `frontend-new/lib/recipes/types.ts`
- `frontend-new/lib/recipes/repository.ts`
- `frontend-new/lib/recipes/approval.ts`
- `frontend-new/lib/recipes/review-lifecycle.ts`
- `frontend-new/lib/orchestration/schedule.ts`

## Execution

Research → detailed plans → independent plan check → scoped implementation → regression/verification. Existing dirty changes belong to prior work; preserve them and avoid broad commits. Testing uses synthetic fixtures clearly marked as such and the isolated local database only.
