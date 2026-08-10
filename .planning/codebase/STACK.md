# STACK

## Repository Composition
- Active application is `frontend-new` (Next.js App Router, TypeScript).
- Supporting legacy directories exist: `backend` (Python utility scripts) and `ovona` (older client lib stubs).
- Main runtime entry for local dev is `frontend-new/package.json` script `dev` -> `next dev --webpack`.

## Languages and Runtimes
- TypeScript + React 19 in `frontend-new/app` and `frontend-new/lib`.
- Node.js runtime for Next.js API route handlers in `frontend-new/app/api/**/route.ts`.
- Python scripts in `backend/meal_plan.py` and `backend/ingredients.py` are not wired into Next.js runtime.

## Frameworks and UI
- Next.js 16.0.1 (`frontend-new/package.json`).
- React 19.2.0 + React DOM 19.2.0.
- Material UI v7 (`@mui/material`, `@mui/icons-material`, Emotion styling).
- Theme and app shell are defined in `frontend-new/app/providers.tsx`.

## Data and Auth SDKs
- Supabase client SDK (`@supabase/supabase-js`) used on client and server.
- Supabase route helper package (`@supabase/auth-helpers-nextjs`) used in `frontend-new/lib/supabaseServer.ts`.
- OpenAI Node SDK (`openai`) used by:
  - `frontend-new/lib/generation/nutritionist.ts`
  - `frontend-new/app/api/normalize-shopping-list/route.ts`

## Charting and Misc Libraries
- `recharts` present for data visualization.
- `lucide-react` present for iconography.

## Tooling
- TypeScript strict mode enabled in `frontend-new/tsconfig.json`.
- ESLint 9 with Next presets in `frontend-new/eslint.config.mjs`.
- Tailwind PostCSS plugin configured in `frontend-new/postcss.config.mjs` (Tailwind utility usage appears minimal vs MUI).

## Build and Run Commands
- Install: `npm install` in `frontend-new`.
- Dev: `npm run dev`.
- Lint: `npm run lint`.
- Convenience launcher exists at `start-ovona.ps1` (installs and starts frontend dev server).

## Database Schema/Migrations in Repo
- Supabase migration file at `frontend-new/supabase/migrations/20260217_generation_pipeline.sql`.
- Migration adds generation tables/columns (`meal_concepts`, `user_meal_history`, extended preferences/ingredients columns).

## Environment Variables (by code reference)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_SHOPPING_NORMALIZE`
- `OPENAI_MEAL_MODEL`
