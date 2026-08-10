## 1. Production Supabase baseline

- [x] 1.1 Inventory every Supabase table, relationship, constraint, RPC/function, storage dependency, and seed requirement referenced by `frontend-new`.
- [x] 1.2 Compare the inventory with the restarted Supabase project and create version-controlled migrations that provision the full required schema from a fresh project.
- [ ] 1.3 Apply and verify the migration baseline in an isolated environment, including required seed/reference data for meal generation.
- [ ] 1.4 Enable and audit row-level security policies for every user-owned table; verify allowed owner operations and cross-user isolation with separate test accounts. (Policy migration prepared; live verification pending.)

## 2. Application deployment readiness

- [x] 2.1 Replace the hard-coded localhost Google OAuth return URL with an environment-aware production/local site URL helper.
- [x] 2.2 Add minimal mobile web metadata and icons needed for reliable phone home-screen installation.
- [x] 2.3 Add production configuration documentation identifying public versus server-only variables and required Vercel settings.
- [x] 2.4 Add a documented production smoke-test procedure and a runnable request-level check where practical for authenticated state and preference endpoints.

## 3. User-owned cloud configuration

- [ ] 3.1 Create or confirm the dedicated Supabase production project and provide its project URL and anon key through private deployment configuration.
- [ ] 3.2 Configure Supabase Auth Site URL and allowed redirect URLs for the production domain and local development.
- [ ] 3.3 Configure Google as a Supabase Auth provider using the Supabase provider callback URL and verify consent-screen access for the owner account.
- [ ] 3.4 Create a Vercel project linked to the repository and configure production environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `OPENAI_API_KEY`, and `OPENAI_MEAL_MODEL`.

## 4. Deploy and verify

- [ ] 4.1 Deploy the application to the Vercel production URL and confirm build-time and runtime environment configuration.
- [ ] 4.2 Execute the production smoke test on a phone: Google sign-in, onboarding save, plan generation, plan reload, meal swap, and shopping-list retrieval.
- [ ] 4.3 Record and fix deployment-blocking failures, then repeat the smoke test until the daily dogfood workflow passes.
