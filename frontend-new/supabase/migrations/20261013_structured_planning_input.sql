-- Additive fields only: older deployments may still be read through the compatibility fallbacks.
alter table if exists public.user_preferences
  add column if not exists never_foods jsonb,
  add column if not exists food_likes jsonb,
  add column if not exists max_prep_minutes integer;

alter table if exists public.user_meal_history
  add column if not exists recipe_id text,
  add column if not exists recipe_version integer,
  add column if not exists similarity_key text,
  add column if not exists planning_state text,
  add column if not exists rejection_reason text;

-- This migration may be applied before the trusted-evidence migration. Keep
-- its small history dependency self-contained so rejection feedback cannot
-- fail merely because a later additive migration has not run yet.
alter table if exists public.user_meal_history
  drop constraint if exists user_meal_history_recipe_version_valid,
  add constraint user_meal_history_recipe_version_valid
    check (recipe_version is null or recipe_version > 0),
  drop constraint if exists user_meal_history_planning_state_valid,
  add constraint user_meal_history_planning_state_valid
    check (planning_state is null or planning_state in ('accepted', 'eaten', 'rejected'));
