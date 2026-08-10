# Production Supabase Inventory

This document captures the database contract inferred from the active `frontend-new` codebase. It is the source checklist for rebuilding the restarted Supabase project and creating the missing migration baseline.

## External services

- Supabase Auth provides the `auth.users` identity referenced by user-owned records.
- No Supabase RPC calls or Storage buckets are referenced by the active application.
- OpenAI is called only from server route/module code; it does not require Supabase Storage.

## Required application tables

| Table | Required operations | Minimum fields/relationships inferred from code | Ownership/RLS expectation |
| --- | --- | --- | --- |
| `profiles` | select, upsert | `id` (matches `auth.users.id`), profile/preference fields including name and goal data | Users can read and update only their own row. |
| `user_preferences` | select, upsert | `user_id` (matches `auth.users.id`), dietary and macro preferences; migration extends it with `meals_per_day`, `max_prep_minutes`, `weekly_budget`, `dietary_mode`, `cuisine_preferences`, and `health_conditions` | Users can read and update only their own row. |
| `user_allergies` | select, delete, insert | `user_id` (matches `auth.users.id`), allergy value fields consumed by onboarding and context building | Users can read, replace, and create only their own rows. |
| `plan_history` | select, insert, delete | `user_id`, `plan_id`, `day_id`, `date`, `week_start`, `meals` JSON payload, `created_at`; also stores shopping-list and alternatives records using sentinel `day_id` values | Users can read, insert, and delete only their own plans. |
| `meal_plans` | upsert | `user_id`, `name`, `week_start_date`, `total_calories`; unique constraint on `(user_id, week_start_date)` | Users can upsert and read only their own plans. |
| `meal_logs` | select, upsert | `user_id`, `meal_instance_id`, `date`, and completion/status fields; unique constraint compatible with one log per meal instance and date | Users can read and write only their own logs. |
| `ingredients` | select, insert | ingredient name plus macro/micronutrient fields; migration extends it with iron, omega-3, B12, vitamin D, folate, calcium, fibre, `verified`, and `source` | Readable by authenticated users. Inserts must be limited to a trusted server path or otherwise tightly controlled. |
| `meal_concepts` | count, select, insert | Defined in `20260217_generation_pipeline.sql`: id, recipe concept content, dietary flags, provenance, and timestamps | Readable for generation. Inserts are generated content and should be server-controlled or limited to trusted authenticated flows. |
| `user_meal_history` | select, insert | Defined in `20260217_generation_pipeline.sql`: user id, optional concept id, meal name/protein/date/slot, timestamps | Users can read and create only their own history. |

## Versioned schema currently present

`supabase/migrations/20260217_generation_pipeline.sql` creates `meal_concepts` and `user_meal_history`, adds generation-related columns to `user_preferences` and `ingredients`, and creates supporting indexes. It assumes that `user_preferences` and `ingredients` already exist.

## Seed and bootstrap requirements

- `meal_concepts` can be populated from the app's static fallback library on first generation; no static SQL seed is required for basic operation, but the insert policy must support the server generation path.
- `ingredients` can be enriched during generation when unknown ingredients are encountered. A curated seed improves nutrition quality but is not currently required for the application to start.
- User-owned tables do not need seed rows; they are created through onboarding and normal use.

## Baseline gaps to resolve before production

1. Capture creation SQL, constraints, indexes, and RLS policies for all foundational tables listed above.
2. Confirm exact preference/profile/allergy column names and existing enum/check constraints in the restarted Supabase project.
3. Confirm `plan_history` sentinel-row conventions for shopping lists and alternatives are supported by its constraints.
4. Verify direct browser writes from onboarding/planner comply with RLS, or route those writes through authenticated server endpoints.
5. Generate TypeScript database types from the completed production schema to make further schema drift visible during development.
