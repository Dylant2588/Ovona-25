# Private Deployment Guide

## Vercel configuration

Create a Vercel project from this repository and set `frontend-new` as its Root Directory. Configure these production variables in Vercel; enter values only in the Vercel dashboard.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Browser authentication/data client key. |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical production URL, including `https://`. |
| `OPENAI_API_KEY` | Server only | Meal-generation API credential. |
| `OPENAI_MEAL_MODEL` | Server only | Optional meal-generation model override. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Optional authenticated preference-write fallback; never prefix it with `NEXT_PUBLIC_`. |

Vercel preview URLs are useful for development, but set `NEXT_PUBLIC_SITE_URL` to the stable production domain.

## Supabase Auth configuration

In Supabase Auth URL Configuration, set Site URL to the production URL and allow:

- `https://<production-domain>/auth/callback`
- `http://localhost:3000/auth/callback`

Configure Google OAuth in Supabase using its provider callback URL, then test sign-in from the production deployment.

## Production smoke test

1. Open the production URL on a phone and sign in with Google.
2. Complete onboarding and confirm preferences save without an error.
3. Generate a weekly meal plan and wait for a generated or fallback result.
4. Reload the app and confirm the saved plan remains present.
5. Swap one meal, reload, and confirm the swap remains present.
6. Open the shopping list and confirm it contains the current plan's ingredients.
7. On a second test account, confirm the first account's plan and preferences are not visible.

For request-level checks while a deployment is running, execute:

```powershell
npm run check:phase1:reliability --prefix frontend-new
```

Use the production URL as the script's `BaseUrl` parameter when running it outside localhost.
