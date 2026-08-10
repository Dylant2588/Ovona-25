# STRUCTURE

## Top-Level Layout
- `frontend-new/` -> active Next.js app.
- `backend/` -> legacy Python helpers (`meal_plan.py`, `ingredients.py`, `tesco_prices.json`).
- `ovona/` -> legacy library folder (`ovona/lib/*`, minimal current use).
- `start-ovona.ps1` -> local startup helper script.

## `frontend-new` Directory Map
- `frontend-new/app/`
  - `layout.tsx` -> root metadata/layout.
  - `providers.tsx` -> MUI theme + auth provider wrapper.
  - `login/page.tsx`, `onboarding/page.tsx`, `auth/callback/page.tsx`.
  - `meals/page.tsx` -> main planner/shopping UI.
  - `api/` -> route handlers (server-side).

- `frontend-new/app/api/`
  - `meal-plan/route.ts` -> weekly generation endpoint.
  - `meal-plan/generate/route.ts` -> re-export to meal-plan route.
  - `meal-plan/state/route.ts` -> load/save plan snapshots.
  - `meal-plan/generate/day/route.ts` -> day regeneration.
  - `meal-plan/generate/meal/route.ts` -> re-export to swap route.
  - `meal-plan/swap/route.ts` -> meal swap orchestration.
  - `shopping-list/route.ts` -> list persistence + basket pricing.
  - `normalize-shopping-list/route.ts` -> deterministic/AI normalization.
  - `meal-log/route.ts` -> status tracking.
  - `preferences/route.ts` -> canonical preference/profile persistence.

- `frontend-new/lib/`
  - Core: `meal-generator.ts`, `macro-enforcement.ts`, `tesco-prices.ts`.
  - Auth: `supabaseClient.ts`, `supabaseServer.ts`, `serverAuth.ts`, `auth-context.tsx`.
  - Utilities: `history.ts`, `meal-logs.ts`, `onboarding-meta.ts`, `ingredient-display.ts`.
  - Planning docs artifact: `INTEGRATION.ts` (guide/instructions file, not runtime-critical).

- `frontend-new/lib/generation/`
  - `types.ts` shared pipeline contracts.
  - `context-builder.ts` user/context target assembly.
  - `nutritionist.ts` concept generation and prompting.
  - `medical-engine.ts` portioning + health-aware nudges.
  - `practical-engine.ts` cost/practical optimization.
  - `validation-gate.ts` ingredient validation.
  - `meal-storage.ts` concept/history persistence.
  - `generate-plan.ts` orchestrator.
  - `fallback.ts` static fallback generator.

- `frontend-new/supabase/migrations/`
  - `20260217_generation_pipeline.sql`.

## Naming and Organization Notes
- API handlers consistently named `route.ts` per Next App Router conventions.
- Domain logic mostly avoids framework dependencies and lives in `lib/*`.
- Some thin re-export routes are used for backward compatibility (`generate/route.ts`, `generate/meal/route.ts`).
- `planner/` directory exists under `app/` but appears empty in current state.
