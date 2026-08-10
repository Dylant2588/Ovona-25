# INTEGRATIONS

## Primary External Services

### Supabase (Auth + Postgres)
- Client auth/session checks from `frontend-new/lib/supabaseClient.ts` and `frontend-new/lib/auth-context.tsx`.
- Server-side auth resolution in `frontend-new/lib/serverAuth.ts`.
- Cookie-backed route handler client in `frontend-new/lib/supabaseServer.ts`.
- API handlers query/write Supabase tables via Next routes under `frontend-new/app/api/**`.

### OpenAI
- Meal concept generation in `frontend-new/lib/generation/nutritionist.ts`.
- Shopping-list normalization in `frontend-new/app/api/normalize-shopping-list/route.ts`.
- Model name is configurable via `OPENAI_MEAL_MODEL` (default `gpt-4o-mini`).

## Supabase Tables Referenced in Code
- `user_preferences` (`/api/preferences`, onboarding/meals profile loads).
- `profiles` (`/api/preferences`, onboarding load/save, context building).
- `user_allergies` (`/api/preferences`, context building).
- `meal_logs` (`/api/meal-log`).
- `plan_history` (`/api/meal-plan/state`, `/api/shopping-list`, `/api/meal-plan/swap`, `/api/meal-plan/route`).
- `meal_plans` (`/api/meal-plan/state` upsert summary row).
- `meal_concepts` and `user_meal_history` (generation pipeline storage/history).
- `ingredients` (validation and medical/practical generation passes).

## API Surface (Internal)
- Meal generation: `POST /api/meal-plan` (aliased by `POST /api/meal-plan/generate`).
- Persist/load generated week: `POST/GET /api/meal-plan/state`.
- Regenerate day: `POST /api/meal-plan/generate/day`.
- Swap meal: `POST /api/meal-plan/generate/meal` (re-export to swap route).
- Log meal status: `POST /api/meal-log`.
- Shopping list: `POST/GET /api/shopping-list`.
- Shopping normalization: `POST /api/normalize-shopping-list`.
- Preferences save: `POST /api/preferences`.

## Auth and Token Flow
- Client attempts cookie session first.
- If no server session cookie, routes accept bearer fallback (`Authorization: Bearer <token>`), logged as `using bearer fallback auth`.
- `resolveRequestAuth` binds Supabase client to bearer token for RLS-safe DB operations.

## Pricing Integration
- Local price catalog lives in `frontend-new/lib/tesco-prices.ts`.
- `priceBasket` returns subtotal/fresh/staples and unmatched items.
- `/api/shopping-list` returns both normalized items and computed pricing payload.

## Data Persistence Pattern
- Week plan rows persisted into `plan_history` by day.
- Synthetic rows also persist:
  - `day_id = shopping-list`
  - `day_id = alternatives`
- Meal swaps overwrite specific day row and refresh shopping-list row.

## Legacy/Secondary Integrations
- `backend/meal_plan.py` includes OpenAI call but is not currently wired into Next API runtime.
- `backend/tesco_prices.json` appears superseded by in-code catalog in `frontend-new/lib/tesco-prices.ts`.
