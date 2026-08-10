# TESTING

## Current State
- No dedicated unit/integration test suites were found in `frontend-new`.
- No `*.test.*`, `*.spec.*`, or `__tests__` directories detected.
- `package.json` scripts include `lint`, but no `test` script.

## Existing Quality Signals
- Static analysis via ESLint (`npm run lint`).
- TypeScript compile-time checks (strict mode, no emit).
- Runtime validation inside API handlers (input guards and fallback handling).

## Practical Validation Workflow Today
- Developers validate by running the app locally (`npm run dev`).
- Manual checks appear centered around:
  - onboarding save flow
  - meal generation/swap/regeneration
  - shopping list generation and pricing
  - auth/session behavior with Supabase

## Testability Notes by Subsystem
- `frontend-new/lib/generation/*` is mostly pure enough for unit tests with mocked Supabase/OpenAI.
- `frontend-new/lib/meal-generator.ts` contains deterministic helpers that can be snapshot/table-tested.
- Route handlers in `frontend-new/app/api/**/route.ts` can be tested with request/response harnesses and mocked clients.

## High-Value Missing Tests
- Auth fallback correctness in `frontend-new/lib/serverAuth.ts`.
- Preferences compatibility fallbacks in `frontend-new/app/api/preferences/route.ts`.
- Plan persistence and retrieval shape compatibility in `frontend-new/app/api/meal-plan/state/route.ts`.
- Shopping list pricing edge cases in `frontend-new/lib/tesco-prices.ts`.
- Macro enforcement bounds in `frontend-new/lib/macro-enforcement.ts`.

## Suggested Test Stack (aligned with codebase)
- Unit tests: Vitest or Jest + TypeScript.
- React component tests: React Testing Library for key page flows.
- API route tests: Next request mocks + Supabase client stubs.
- Optional e2e: Playwright for login/onboarding/generate-plan critical path.

## CI Status
- No CI configuration files were identified in this repository snapshot.
- Lint/test/build gates are therefore likely manual/local at the moment.
