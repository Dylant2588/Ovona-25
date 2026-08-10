# CONCERNS

## 1) Large Stateful UI Surface
- `frontend-new/app/meals/page.tsx` is very large and handles fetching, persistence, retries, swapping, regeneration, and UI.
- Risk: regression-prone changes, difficult debugging, hook dependency drift.
- Evidence: existing lint warnings around hook dependencies.

## 2) Schema Drift and Compatibility Workarounds
- Preference persistence requires fallback variants (`lose_weight` vs `lose`, `pescatarian` vs `pescetarian`, complexity numeric/text).
- Risk: database constraint drift across environments causes runtime save failures.
- Files: `frontend-new/app/api/preferences/route.ts`, `frontend-new/app/onboarding/page.tsx`.

## 3) Auth Complexity Around Cookie/Bearer Modes
- Route auth supports both cookie session and bearer fallback.
- Risk: subtle RLS/authorization bugs if token-bound client handling regresses.
- File: `frontend-new/lib/serverAuth.ts`.

## 4) Mixed Persistence Paths
- Onboarding still does additional direct profile writes after calling `/api/preferences`.
- Risk: partial writes and eventual inconsistency across `user_preferences`, `profiles`, `user_allergies`.
- Files: `frontend-new/app/onboarding/page.tsx`, `frontend-new/app/api/preferences/route.ts`.

## 5) Limited Automated Test Coverage
- No test suite currently detected.
- Risk: high change velocity with low confidence in critical nutrition/auth flows.

## 6) Monolithic Domain File
- `frontend-new/lib/meal-generator.ts` is very large and contains many responsibilities.
- Risk: cognitive load, accidental coupling, and harder isolated validation.

## 7) Operational Resilience and Observability
- Heavy reliance on `console.warn`/`console.error` logging without centralized telemetry.
- Risk: production diagnosis is harder; noisy logs can obscure root cause.

## 8) Legacy/Unused Artifacts
- Legacy directories/files (`backend/*`, `ovona/lib/*`, `frontend-new/lib/INTEGRATION.ts`) coexist with active system.
- Risk: confusion about source of truth and accidental edits in stale paths.

## 9) Data Quality and Normalization Risks
- Shopping normalization can run deterministic or LLM-assisted modes.
- Risk: inconsistent outputs based on env flags (`OPENAI_SHOPPING_NORMALIZE`) and model behavior.
- File: `frontend-new/app/api/normalize-shopping-list/route.ts`.

## 10) Security and Secret Handling
- Env-based secrets are required for Supabase service role and OpenAI.
- Risk: accidental leakage through logs/docs if not carefully controlled.
- Relevant files: `frontend-new/app/api/preferences/route.ts`, `frontend-new/lib/generation/nutritionist.ts`.

## Immediate Stabilization Opportunities
- Split `meals/page.tsx` into feature hooks/components.
- Add tests for auth fallback + preferences constraints + plan state round-trips.
- Introduce migration/state checks to detect schema mismatch early at startup.
- Keep a single write path for profile/preferences where possible.
