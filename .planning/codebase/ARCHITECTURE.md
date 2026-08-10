# ARCHITECTURE

## High-Level Shape
- Monolithic Next.js app with co-located UI and backend route handlers.
- Primary app path is under `frontend-new/app`.
- Domain logic is concentrated in `frontend-new/lib/meal-generator.ts` plus modular generation pipeline files in `frontend-new/lib/generation/*`.

## Runtime Layers

### 1) Presentation Layer
- App shell and theming: `frontend-new/app/providers.tsx`.
- Auth/login/onboarding pages:
  - `frontend-new/app/login/page.tsx`
  - `frontend-new/app/onboarding/page.tsx`
  - `frontend-new/app/auth/callback/page.tsx`
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
1. `app/meals/page.tsx` requests generation (`/api/meal-plan/generate`).
2. `app/api/meal-plan/route.ts` authenticates user and calls `generateWeeklyPlanWithArtifacts`.
3. Pipeline builds context, generates concepts, validates, portions, applies practical/health adjustments, and returns weekly plan.
4. Route enforces macro bounds and persists alternatives row.
5. Client persists displayed plan week via `/api/meal-plan/state`.
6. Shopping list generated/persisted via `/api/shopping-list`.

## Storage Model
- `plan_history` acts as denormalized plan-state/event store for days and derived artifacts.
- `meal_logs` stores meal status changes by `(user_id, meal_instance_id, date)`.
- `meal_concepts` and `user_meal_history` support generation memory and rotation.

## Architectural Characteristics
- Strong use of fallback logic for resilience (LLM failures, missing data, schema drift).
- Generation pipeline is modular but still tightly coupled to Supabase schema assumptions.
- Frontend `meals/page.tsx` is a large orchestrating component handling auth fetch, regeneration, persistence, and UI state.
