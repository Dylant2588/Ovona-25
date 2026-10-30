# Ovona MVP reset roadmap

Date: 2026-10-28. Source: Phase 0 audit and explicit user approval of Phase 1 planning.

This scoped roadmap distinguishes the newly approved MVP phases from the historical `.planning/ROADMAP.md`, whose Phase 1 is Auth + Onboarding Reliability. Do not execute the historical Phase 1 for this request. Preserve historical planning and in-flight changes.

| Phase | Goal | Status |
|---|---|---|
| 1: Trustworthy baseline | Repair review lifecycle, dietary admission and durable safety preferences; restore meaningful test/lint gates; verify migrations and RLS in a disposable database | Software and browser flows verified; one timing-specific in-flight identity subcheck remains recorded |
| 2: Catalogue and nutrition | Precise ingredients/units, reproducible ingredient-derived nutrition, reviewed catalogue coverage | Software verified: 147 tests + 11 actual DB tests PASS; genuine calculated catalogue/content review pending |
| 3: Saved plans and shopping | Atomic revisions, authoritative replacement, revision-derived shopping/history | Proposed; not authorised |
| 4: Validated AI adaptations | Typed proposals, recalculation, versioning and user acceptance | Proposed; not authorised |
| 5: Products and pricing | Retailer-independent products/mappings, ingestion, qualified basket optimisation | Proposed; not authorised |

## Phase 1

Goal: A valid pending recipe can enter the reviewed catalogue, approved dietary-safe recipes reach scheduling, required restrictions survive persistence, and release checks provide credible evidence.

Requirements: BASE-01 through BASE-09 in REQUIREMENTS.md.
Plans: See phases/01-trustworthy-baseline/README.md after planning.

Execution handoff: use this scoped roadmap and its exact plan paths. Generic `/gsd-execute-phase 1` currently resolves the historical phase and must not be used without explicit scoped context. Planning does not authorise production migrations, deployment, dependency installation, or later phases.

## Phase 2

User authorised Phase 2 on 2026-10-29 after its scope was explained. Requirements CAT-01 through CAT-06 are defined in `phases/02-catalogue-and-nutrition/02-CONTEXT.md`. Plans and ownership: `phases/02-catalogue-and-nutrition/README.md`. Implement after plan-check passes, with outstanding Phase 1 browser defects corrected and verified. Human catalogue review is an operational gate distinct from passing software tests; no live rollout or Phase 3 is authorised.
