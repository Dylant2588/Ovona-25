<!-- GSD:project-start source:PROJECT.md -->
## Project

**Ovona**

Ovona is a nutrition-first meal planning product that generates a practical weekly plan and shopping list from each user's goals and preferences. The current product is centered on "don't think about food" execution: generate meals, swap meals you dislike, and stay aligned to daily targets. It is built for individuals first, with family and health-condition personalization as the next expansion.

**Core Value:** Users can reliably hit their protein and calorie goals each week with minimal decision-making.

### Constraints

- **Tech stack**: Next.js App Router + Supabase + OpenAI SDK � keep implementation inside current stack for velocity
- **Data reliability**: Supabase schema differences/check constraints across environments � enforce compatibility-safe writes
- **UX intent**: Low-cognitive-load workflow � minimize clicks and explicit tracking burden
- **Scope**: Individual-user POC first, then family and condition-aware expansion � protect focus
- **Performance**: Planner must remain responsive in local/dev usage � favor deterministic fallbacks when AI paths fail
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## TypeScript and Typing
- Project uses strict TypeScript (`frontend-new/tsconfig.json`: `strict: true`).
- Domain types are explicit and centralized in files like:
- API routes frequently parse/guard JSON payloads with local `type` declarations.
## File/Module Conventions
- Next App Router conventions:
- Shared business logic is placed under `lib/` and imported via path alias `@/*`.
## Error Handling Style
- API handlers return structured JSON errors and explicit HTTP status codes.
- Many handlers use `try/catch` with graceful fallback behavior.
- Logging style uses contextual prefixes like `[meal-plan]`, `[preferences]`, `[auth]`.
## Auth Convention
- Route handlers resolve auth through `resolveRequestAuth(request)` from `frontend-new/lib/serverAuth.ts`.
- Pattern:
## Data Normalization Patterns
- Multiple utility normalizers are used:
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
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## High-Level Shape
- Monolithic Next.js app with co-located UI and backend route handlers.
- Primary app path is under `frontend-new/app`.
- Domain logic is concentrated in `frontend-new/lib/meal-generator.ts` plus modular generation pipeline files in `frontend-new/lib/generation/*`.
## Runtime Layers
### 1) Presentation Layer
- App shell and theming: `frontend-new/app/providers.tsx`.
- Auth/login/onboarding pages:
- Main planner UX: `frontend-new/app/meals/page.tsx`.
### 2) API Layer (Next Route Handlers)
- Under `frontend-new/app/api/**/route.ts`.
- Handles auth, validation, persistence, and orchestration calls.
- Routes are thin orchestration wrappers around `lib/*` domain logic.
### 3) Domain Layer
- Fallback generation and swap/regeneration: `frontend-new/lib/meal-generator.ts`.
- Macro enforcement and plan correction: `frontend-new/lib/macro-enforcement.ts`.
- Ingredient display formatting: `frontend-new/lib/ingredient-display.ts`.
- Pricing engine: `frontend-new/lib/tesco-prices.ts`.
### 4) Generation Pipeline Subsystem
- Orchestrator: `frontend-new/lib/generation/generate-plan.ts`.
- Context builder: `frontend-new/lib/generation/context-builder.ts`.
- Meal creation (LLM + fallback): `frontend-new/lib/generation/nutritionist.ts`, `frontend-new/lib/generation/fallback.ts`.
- Medical/portion logic: `frontend-new/lib/generation/medical-engine.ts`.
- Practical constraints and pricing adjustments: `frontend-new/lib/generation/practical-engine.ts`.
- Persistence: `frontend-new/lib/generation/meal-storage.ts`.
- Validation gate: `frontend-new/lib/generation/validation-gate.ts`.
## Core Request Flow (Meal Week)
## Storage Model
- `plan_history` acts as denormalized plan-state/event store for days and derived artifacts.
- `meal_logs` stores meal status changes by `(user_id, meal_instance_id, date)`.
- `meal_concepts` and `user_meal_history` support generation memory and rotation.
## Architectural Characteristics
- Strong use of fallback logic for resilience (LLM failures, missing data, schema drift).
- Generation pipeline is modular but still tightly coupled to Supabase schema assumptions.
- Frontend `meals/page.tsx` is a large orchestrating component handling auth fetch, regeneration, persistence, and UI state.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
