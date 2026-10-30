---
quick: 261013-qxl
status: complete
---

# Structured planning input

Ovona now assembles one server-owned planning input that separates hard safety
exclusions from soft food tastes, practical limits, and the last 14 days of
accepted, eaten, and rejected recipe history.

## Delivered

- Added validated `PlanningInput` construction and a non-identifying AI brief.
- Persisted `neverFoods`, `foodLikes`, maximum prep time, and reviewed-recipe
  rejection feedback through additive database migration support.
- Enforced allergies, dietary rules, never foods, and maximum prep time before
  candidates can reach AI ranking or final approval.
- Added preference controls for Avoid foods, Never include, Foods you like,
  and a quick-meal time limit.
- Recorded a meal swap as server-resolved negative feedback; the client submits
  only its saved meal-instance ID, never a recipe identity or version.
- Kept the preferences read compatible with Supabase deployments that have not
  yet applied the additive migration.

## Verification

- `npx tsc --noEmit --pretty false`
- Focused orchestration tests: 20 passed.
- Focused ESLint: no errors; existing hook/unused-variable warnings remain.
- Opened the local planner and visually verified the new preference drawer.

## Operational follow-up

Apply `frontend-new/supabase/migrations/20261013_structured_planning_input.sql`
to enable persistent structured fields and rejected-feedback history in Supabase.
