# CONVENTIONS

## TypeScript and Typing
- Project uses strict TypeScript (`frontend-new/tsconfig.json`: `strict: true`).
- Domain types are explicit and centralized in files like:
  - `frontend-new/lib/meal-generator.ts`
  - `frontend-new/lib/generation/types.ts`
- API routes frequently parse/guard JSON payloads with local `type` declarations.

## File/Module Conventions
- Next App Router conventions:
  - Page components in `app/**/page.tsx`.
  - API handlers in `app/api/**/route.ts`.
- Shared business logic is placed under `lib/` and imported via path alias `@/*`.

## Error Handling Style
- API handlers return structured JSON errors and explicit HTTP status codes.
- Many handlers use `try/catch` with graceful fallback behavior.
- Logging style uses contextual prefixes like `[meal-plan]`, `[preferences]`, `[auth]`.

## Auth Convention
- Route handlers resolve auth through `resolveRequestAuth(request)` from `frontend-new/lib/serverAuth.ts`.
- Pattern:
  - return `401` if no user.
  - log warning when running in bearer fallback mode.

## Data Normalization Patterns
- Multiple utility normalizers are used:
  - delimited string parsing for legacy DB columns.
  - unit normalization for shopping list quantities.
  - goal/lifestyle normalization for schema compatibility.
- Preference persistence intentionally uses fallback variants to survive schema drift.

## UI Conventions
- MUI components and `sx` styling are primary UI pattern.
- Global dark theme defined once in `frontend-new/app/providers.tsx`.
- Main planner page (`frontend-new/app/meals/page.tsx`) centralizes large amounts of state and effects.

## API/Domain Boundaries
- API routes are mostly orchestrators that call `lib/` functions.
- Heavy computations (generation, enforcement, pricing) stay out of route handlers.
- Persistence and derivations are mixed in some endpoints (not fully service-separated).

## Linting/Quality Gates
- ESLint configured with Next core web vitals + TypeScript presets.
- Current codebase has warnings but no mandatory test gate enforced in scripts.

## Notable Style Inconsistencies
- Some legacy encoding/mojibake strings appear in parts of code history (not fully cleaned).
- Logging verbosity is high in runtime code paths.
- Mixed persistence entry points exist (`onboarding` direct profile writes plus `/api/preferences` flow).
