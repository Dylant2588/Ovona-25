# Requirements: Ovona

**Defined:** 2026-04-13
**Core Value:** Users can reliably hit their protein and calorie goals each week with minimal decision-making.

## v1 Requirements

### Authentication & Access

- [ ] **AUTH-01**: User can sign in with Google and maintain a valid session across refresh/navigation
- [ ] **AUTH-02**: Protected planner routes return user to login when no valid session exists

### Onboarding & Preferences

- [ ] **ONB-01**: User can complete onboarding step flow and save goal, weight, height, and activity level
- [ ] **ONB-02**: User can save dietary mode, allergies, dislikes, and cooking-time preferences without constraint failures
- [ ] **ONB-03**: User can skip onboarding defaults and still generate a usable starter plan

### Nutrition Targeting

- [ ] **NUTR-01**: System calculates daily calorie and protein targets from profile + goal when explicit targets are missing
- [ ] **NUTR-02**: System enforces daily plan output toward protein and calorie targets with bounded corrections
- [ ] **NUTR-03**: User can choose 3-meal or 5-meal cadence and receive correctly distributed meal slots

### Meal Planning

- [ ] **PLAN-01**: User can generate a weekly meal plan and receive five workday plans with per-day totals
- [ ] **PLAN-02**: User can regenerate an individual day while preserving week context
- [ ] **PLAN-03**: User can swap an individual meal and receive updated day totals
- [ ] **PLAN-04**: Generated meal cards show usable ingredients and recipe steps for execution

### Shopping & Pricing

- [ ] **SHOP-01**: User can generate a normalized shopping list from the current persisted plan
- [ ] **SHOP-02**: Shopping list response includes basket pricing summary (subtotal, fresh/staples split, unmatched items)
- [ ] **SHOP-03**: Shopping list persists and reloads for the selected week

### Logging & State Reliability

- [ ] **LOG-01**: User can log meal status updates (`planned`, `eaten`, `skipped`, `swapped`) without API failures
- [ ] **LOG-02**: Plan state save/load (`/api/meal-plan/state`) works consistently with cookie or bearer auth
- [ ] **LOG-03**: API date validation returns clear client errors (`400`) instead of opaque server errors (`500`)

## v2 Requirements

### Family & Household

- **FAM-01**: Family plans support multiple household members with shared and per-person meals
- **FAM-02**: Household preference resolution supports conflicting tastes and allergies

### Clinical Nutrition Intelligence

- **MICRO-01**: System tracks recency of key nutrient sources (for example fish/omega, red meat/iron)
- **MICRO-02**: System suggests ingredient choices based on condition flags (for example anemia-aware suggestions)
- **MICRO-03**: Supplement planning integrates into weekly nutritional recommendations

### Delivery Operations

- **OPS-01**: Meal plans can be exported to fulfillment-ready order bundles
- **OPS-02**: Delivery orchestration APIs support future autonomous delivery modes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Drone delivery execution | Operationally heavy and not required to validate core planner value |
| Full medical diagnosis or treatment advice | Requires regulatory/clinical workflows beyond v1 planner scope |
| Native mobile apps | Web product must stabilize first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| ONB-01 | Phase 1 | Pending |
| ONB-02 | Phase 1 | Pending |
| ONB-03 | Phase 1 | Pending |
| LOG-02 | Phase 1 | Pending |
| NUTR-01 | Phase 2 | Pending |
| NUTR-02 | Phase 2 | Pending |
| NUTR-03 | Phase 2 | Pending |
| PLAN-01 | Phase 3 | Pending |
| PLAN-02 | Phase 3 | Pending |
| PLAN-03 | Phase 3 | Pending |
| PLAN-04 | Phase 3 | Pending |
| SHOP-01 | Phase 4 | Pending |
| SHOP-02 | Phase 4 | Pending |
| SHOP-03 | Phase 4 | Pending |
| LOG-01 | Phase 5 | Pending |
| LOG-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ?

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13 after initial definition*
