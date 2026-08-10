## Context

The active application is `frontend-new`, a Next.js App Router project using Supabase for authentication and data storage and OpenAI from server route handlers for meal generation. The login page currently hard-codes the OAuth return URL to localhost. The repository contains a generation-pipeline migration but does not yet establish that the complete current Supabase schema can be recreated from migration history.

The owner has restarted the Supabase project and wants a private HTTPS deployment suitable for daily phone testing. See `proposal.md` for motivation and the change specs for user-visible requirements.

## Goals / Non-Goals

**Goals:**

- Run the existing app on a stable HTTPS URL with its actual Supabase and OpenAI integrations.
- Make OAuth redirects correct in both local and production environments.
- Establish a production database baseline, RLS audit, environment configuration, and end-to-end smoke check.
- Support convenient phone use through responsive existing UI and minimal web-app metadata.

**Non-Goals:**

- Building native iOS/Android applications, push notifications, or offline-first behavior.
- Redesigning planner UX or refactoring the generation pipeline.
- Opening the product to public users or implementing billing, quotas, and production observability infrastructure beyond useful deployment logs.

## Decisions

### Host the Next.js app on Vercel

Vercel is the deployment target because the application is already a standard Next.js project and needs a low-friction private URL. A Git-connected production deployment is preferred so releases are reproducible. A custom domain is deferred; the Vercel production domain is sufficient for dogfooding.

Alternative considered: self-hosting a Node server. This adds SSL, process management, and mobile accessibility work without helping the current goal.

### Use a dedicated production Supabase project and migration baseline

The restarted Supabase project is treated as the production data environment. Before application data is relied upon, compare its schema with the application’s table usage and create version-controlled migrations that create all required objects from a fresh project. Apply migrations through the Supabase CLI or an equivalent tracked process; do not leave the dashboard as the only schema source.

Alternative considered: configure tables manually in the dashboard. This is faster once but cannot be reliably recreated or reviewed.

### Keep credentials in deployment configuration

Vercel holds runtime values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `OPENAI_MEAL_MODEL`, and `NEXT_PUBLIC_SITE_URL`. Only the two Supabase public variables and site URL may be delivered to the browser. A service-role key is added only if the final audited server path requires it and is never public.

### Make site URL environment-aware

OAuth redirect construction will use an explicit public site URL with a localhost fallback only during local development. Supabase Auth will allow the exact production callback and localhost callback, and Google OAuth will use the Supabase provider callback configuration required by Supabase.

Alternative considered: hard-code a Vercel URL. This would break preview/local usage and require a code edit for a domain change.

### Verify the owner journey rather than only a successful build

The release gate is a manual, documented smoke run on the deployed URL: sign in, complete/save preferences, generate a plan, reload it, swap a meal, and retrieve the shopping list. This detects configuration, RLS, OAuth, OpenAI, and persistence faults together.

## Risks / Trade-offs

- [The restarted project lacks legacy tables or policies] → inventory all table references and create/test a complete migration baseline before connecting the production URL.
- [RLS blocks direct browser writes or permits cross-user reads] → test both permitted owner operations and isolation behavior using separate test accounts before relying on the deployment.
- [OAuth redirect configuration differs across Google, Supabase, and Vercel] → configure exact production and localhost URLs, then execute an actual phone sign-in before declaring the release ready.
- [OpenAI latency, quota, or credentials fail] → preserve the existing deterministic fallback path and display non-sensitive errors when no fallback can complete.
- [A private dogfood instance is mistaken for public launch readiness] → keep public access, billing, extensive monitoring, and compliance work explicitly out of this change.

## Migration Plan

1. Inventory the application’s Supabase tables, functions, constraints, policies, and seed requirements against the restarted project.
2. Create and validate a complete migration baseline locally or in an isolated Supabase environment.
3. Configure the production Supabase project, apply the migrations, and audit RLS policies.
4. Implement site-URL-aware redirects and mobile web metadata; add a deployment/smoke-test guide.
5. Configure Vercel production environment variables and the Supabase/Google OAuth allowlists.
6. Deploy, execute the phone smoke test, and record failures before daily dogfooding begins.

**Rollback:** remove the production domain from Vercel or roll back to the prior Vercel deployment. Do not delete the Supabase project or user data as a deployment rollback step.
