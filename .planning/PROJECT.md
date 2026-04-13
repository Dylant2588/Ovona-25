# Ovona

## What This Is

Ovona is a nutrition-first meal planning product that generates a practical weekly plan and shopping list from each user's goals and preferences. The current product is centered on "don't think about food" execution: generate meals, swap meals you dislike, and stay aligned to daily targets. It is built for individuals first, with family and health-condition personalization as the next expansion.

## Core Value

Users can reliably hit their protein and calorie goals each week with minimal decision-making.

## Requirements

### Validated

- ? User can authenticate and return to a personalized experience (`/login`, `/auth/callback`) — existing
- ? User can complete onboarding and save preferences/profile context to Supabase — existing
- ? User can generate a weekly meal plan and persist it to plan state/history — existing
- ? User can regenerate a day and swap individual meals within a week — existing
- ? User can generate and persist a weekly shopping list with basket pricing — existing
- ? User can log meal outcomes (`planned/eaten/skipped/swapped`) — existing

### Active

- [ ] Daily targets are consistently correct for goal + body data, with protein/calories as primary enforcement
- [ ] Five-meal cadence is user-configurable and correctly split across breakfast/snacks/lunch/dinner
- [ ] Meal cards include genuinely usable recipe steps and ingredients (not macro-only placeholders)
- [ ] Plan persistence and auth fallback paths are stable across paused/resumed Supabase sessions
- [ ] Weekly UX supports fast swap/regenerate loops without API failure states

### Out of Scope

- Drone delivery logistics and autonomous dispatch — deferred until meal-planning engine is consistently trusted
- Full micronutrient clinical recommendations and supplement prescribing — defer until data model and validation are mature
- Multi-tenant family orchestration with per-member optimization in v1 — deferred to post-POC expansion

## Context

- Brownfield Next.js codebase in `frontend-new` with Supabase-backed auth and persistence.
- Existing generation pipeline (`lib/generation/*`) supports context-building, generation, validation, and fallback behavior.
- Existing roadmap pressure comes from real usage friction: API/auth instability, onboarding write failures, and recipe usability gaps.
- A detailed codebase map exists under `.planning/codebase/` and should remain the architectural reference for future phases.

## Constraints

- **Tech stack**: Next.js App Router + Supabase + OpenAI SDK — keep implementation inside current stack for velocity
- **Data reliability**: Supabase schema differences/check constraints across environments — enforce compatibility-safe writes
- **UX intent**: Low-cognitive-load workflow — minimize clicks and explicit tracking burden
- **Scope**: Individual-user POC first, then family and condition-aware expansion — protect focus
- **Performance**: Planner must remain responsive in local/dev usage — favor deterministic fallbacks when AI paths fail

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prioritize protein and calories before broader macro/micro complexity | Matches user's core success metric and immediate value | — Pending |
| Use a 5-meal default pattern (breakfast, snack, lunch, snack, dinner) | Improves protein distribution and adherence | — Pending |
| Keep shopping list + pricing in product loop early | Makes plan execution practical, not just theoretical | — Pending |
| Build family/condition intelligence after single-user weekly flow is stable | Reduces risk and avoids premature complexity | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 after initialization*
