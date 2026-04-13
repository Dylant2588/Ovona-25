# Roadmap: Ovona

## Overview

This roadmap stabilizes Ovona's existing brownfield planner into a dependable v1 weekly nutrition product: correct targets, reliable plan state, usable recipes, and execution-ready shopping workflows. It sequences work from auth/data reliability to nutrition correctness, then planner UX and shopping/logging hardening.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Auth + Onboarding Reliability** - Make login/onboarding persistence dependable
- [ ] **Phase 2: Nutrition Target Engine** - Make calorie/protein targeting and meal-slot distribution correct
- [ ] **Phase 3: Planner Usability Core** - Ensure generation/swap/regenerate flows and recipe usability
- [ ] **Phase 4: Shopping List + Pricing Stability** - Make list/pricing persistence and accuracy production-ready
- [ ] **Phase 5: Logging + API Resilience** - Eliminate persistent 500-class failures and improve observability
- [ ] **Phase 6: Release Readiness** - Validate end-to-end behavior and ship v1 baseline

## Phase Details

### Phase 1: Auth + Onboarding Reliability
**Goal**: Users can always access planner context and successfully save onboarding preferences.
**Depends on**: Nothing (first phase)
**Requirements**: [AUTH-01, AUTH-02, ONB-01, ONB-02, ONB-03, LOG-02]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. New users can complete onboarding without constraint/save failures.
  2. Returning users are routed correctly by auth/session state.
  3. Preference and profile state persists and reloads correctly after refresh.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Consolidate and harden auth/session handling across pages and API routes
- [ ] 01-02: Stabilize onboarding save path through `/api/preferences` compatibility handling
- [ ] 01-03: Add integration checks for onboarding-to-meals transition and persisted user context

### Phase 2: Nutrition Target Engine
**Goal**: Daily protein/calorie goals and meal cadence are calculated and applied correctly.
**Depends on**: Phase 1
**Requirements**: [NUTR-01, NUTR-02, NUTR-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Users without explicit macro targets receive deterministic target calculation from profile/goal.
  2. Generated plans are corrected toward protein/calorie targets with transparent enforcement summary.
  3. 3-meal and 5-meal modes distribute slots and totals correctly.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Verify and refine target calculation logic in context builder and fallback paths
- [ ] 02-02: Tune macro enforcement tolerances and correction strategy with regression checks
- [ ] 02-03: Wire meals-per-day option through onboarding/preferences to generation endpoints

### Phase 3: Planner Usability Core
**Goal**: Weekly planning interaction loop is smooth, predictable, and execution-friendly.
**Depends on**: Phase 2
**Requirements**: [PLAN-01, PLAN-02, PLAN-03, PLAN-04]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Weekly generation returns valid days/meals and persists correctly.
  2. Day regenerate and meal swap complete without broken plan state.
  3. Meal cards provide usable recipe steps and ingredient detail for cooking.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Refactor and harden plan persistence + optimistic UI update sequence
- [ ] 03-02: Improve regeneration/swap handlers and conflict-safe storage updates
- [ ] 03-03: Upgrade recipe content fidelity and card UX actions for real execution use

### Phase 4: Shopping List + Pricing Stability
**Goal**: Shopping list and basket pricing are trustworthy and aligned with current week plan.
**Depends on**: Phase 3
**Requirements**: [SHOP-01, SHOP-02, SHOP-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Shopping list can be rebuilt and reloaded for any week without stale data.
  2. Basket pricing consistently returns subtotal, category costs, and unmatched lines.
  3. Planner UI clearly communicates pricing confidence and missing price matches.
**Plans**: 2 plans

Plans:
- [ ] 04-01: Harden shopping-list storage lifecycle and week scoping
- [ ] 04-02: Improve pricing catalog matching, output formatting, and UI presentation

### Phase 5: Logging + API Resilience
**Goal**: Meal logging and API routes fail gracefully with clear error semantics.
**Depends on**: Phase 4
**Requirements**: [LOG-01, LOG-03]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Meal log updates are idempotent and stable across retries.
  2. Invalid client payload/date issues return actionable 400 responses.
  3. Server logs provide route-context diagnostics without hiding root causes.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Add API input validation and shared guard utilities
- [ ] 05-02: Improve logging/error mapping for meal-log, meal-plan/state, and shopping-list routes

### Phase 6: Release Readiness
**Goal**: Validate v1 baseline and prepare for iterative family/micro expansion.
**Depends on**: Phase 5
**Requirements**: [AUTH-01, ONB-02, NUTR-02, PLAN-03, SHOP-02, LOG-01]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. End-to-end flow (login -> onboarding -> generate -> swap -> shopping -> log) passes on a clean environment.
  2. Known P0/P1 defects are closed or explicitly deferred with rationale.
  3. v2 backlog (family + micronutrient intelligence) is documented against stable v1 baseline.
**Plans**: 2 plans

Plans:
- [ ] 06-01: Run release validation checklist and fix critical defects
- [ ] 06-02: Produce v1 release notes and v2 transition brief

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth + Onboarding Reliability | 0/3 | Not started | - |
| 2. Nutrition Target Engine | 0/3 | Not started | - |
| 3. Planner Usability Core | 0/3 | Not started | - |
| 4. Shopping List + Pricing Stability | 0/2 | Not started | - |
| 5. Logging + API Resilience | 0/2 | Not started | - |
| 6. Release Readiness | 0/2 | Not started | - |
