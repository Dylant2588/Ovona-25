-- Trusted evidence contracts for reviewed recipes, rotation memory, and retailer pricing.
-- All changes are additive so legacy concept-backed history remains valid.

create table if not exists public.recipe_imports (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null,
  recipe_version integer not null check (recipe_version > 0),
  source_reference text not null check (length(trim(source_reference)) > 0),
  rights_declaration text not null check (length(trim(rights_declaration)) > 0),
  payload_hash text not null check (length(trim(payload_hash)) > 0),
  imported_by uuid not null references auth.users(id) on delete restrict,
  imported_at timestamptz not null default now(),
  review_status text not null default 'pending_review' check (review_status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  constraint recipe_import_identity_matches check (coalesce(record->>'id' = recipe_id and (record->>'version')::integer = recipe_version, false)),
  constraint recipe_import_review_matches check (coalesce(record->'review'->>'status' = review_status, false)),
  constraint recipe_import_review_attribution check (
    (review_status = 'pending_review' and reviewed_by is null and reviewed_at is null)
    or (review_status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists recipe_imports_review_status_idx
  on public.recipe_imports (review_status, recipe_id, recipe_version desc);

alter table public.recipe_imports enable row level security;
revoke all on public.recipe_imports from anon, authenticated;
grant all on public.recipe_imports to service_role;

create table if not exists public.retailer_price_observations (
  id uuid primary key default gen_random_uuid(),
  retailer_id text not null check (length(trim(retailer_id)) > 0),
  retailer_name text not null check (length(trim(retailer_name)) > 0),
  ingredient_key text not null check (length(trim(ingredient_key)) > 0),
  pack_size numeric not null check (pack_size > 0),
  pack_unit text not null check (length(trim(pack_unit)) > 0),
  unit_price numeric not null check (unit_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  estimated boolean not null default false,
  source_reference text not null check (length(trim(source_reference)) > 0),
  provenance_status text not null check (provenance_status in ('operator_imported', 'licensed_feed')),
  adapter_version text not null check (length(trim(adapter_version)) > 0),
  import_batch_id text not null check (length(trim(import_batch_id)) > 0),
  observed_at timestamptz not null,
  imported_at timestamptz not null,
  imported_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint retailer_observation_times check (imported_at >= observed_at)
);

create index if not exists retailer_price_observations_freshness_idx
  on public.retailer_price_observations (retailer_id, ingredient_key, observed_at desc);

alter table public.retailer_price_observations enable row level security;
revoke all on public.retailer_price_observations from anon, authenticated;
grant all on public.retailer_price_observations to service_role;

alter table if exists public.user_meal_history
  add column if not exists recipe_id text,
  add column if not exists recipe_version integer,
  add column if not exists similarity_key text,
  add column if not exists cuisine text,
  add column if not exists format text,
  add column if not exists planning_state text;

alter table if exists public.user_meal_history
  drop constraint if exists user_meal_history_recipe_version_valid,
  add constraint user_meal_history_recipe_version_valid check (recipe_version is null or recipe_version > 0),
  drop constraint if exists user_meal_history_planning_state_valid,
  add constraint user_meal_history_planning_state_valid check (planning_state is null or planning_state in ('accepted', 'eaten'));

create index if not exists idx_user_meal_history_rotation
  on public.user_meal_history (user_id, date desc, recipe_id, recipe_version);

alter table if exists public.user_meal_history enable row level security;
revoke all on public.user_meal_history from anon, authenticated;
grant select, insert on public.user_meal_history to authenticated;
grant all on public.user_meal_history to service_role;
drop policy if exists user_meal_history_owner_access on public.user_meal_history;
create policy user_meal_history_owner_access on public.user_meal_history
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Existing recipe_library review policy and protect_approved_recipe_version trigger remain authoritative.
-- Approved recipe versions are immutable under the existing trigger; corrections create new versions.
