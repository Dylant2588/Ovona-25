## Why

Ovona is ready for daily owner testing, but it currently depends on a local development URL and an unverified Supabase environment. A private production deployment is needed so the owner can use the same authenticated meal-planning flow on a phone every day and reveal real-world reliability issues.

## What Changes

- Establish a repeatable production deployment path for the existing Next.js application on Vercel.
- Make Google sign-in redirect safely to the active deployment instead of a hard-coded localhost callback.
- Define and verify the Supabase production baseline: schema migrations, row-level security, user data access, and authentication redirect configuration.
- Define production environment configuration and ensure server-only secrets remain unavailable to the browser.
- Add a deployment smoke-test flow covering authentication, onboarding preferences, plan generation, plan persistence, meal swapping, and shopping-list retrieval.
- Add the minimum mobile web metadata needed to launch the private deployment from a phone home screen.

## Capabilities

### New Capabilities

- `private-production-access`: Authenticated users can access their own deployed Ovona data and meal-planning workflow from a production web URL.
- `deployment-readiness`: The application has a reproducible, secure deployment configuration and a repeatable verification path.

### Modified Capabilities

- None.

## Impact

- Affected app areas: login, authentication callback, application metadata, deployment configuration, and production smoke checks.
- Affected external systems: Vercel, Supabase Auth and Postgres, Google OAuth, and OpenAI API credentials.
- Production setup requires user-owned account actions: creating/configuring the Supabase and Vercel projects, setting secrets, and registering OAuth redirect URLs.
