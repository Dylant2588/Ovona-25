-- Generation pipeline support tables and columns.
-- Run this migration in Supabase SQL editor before enabling the new orchestrated generator.

create extension if not exists pgcrypto;

create table if not exists public.meal_concepts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ingredients text[] not null default '{}',
  steps text[] not null default '{}',
  cuisine text,
  protein_type text,
  meal_slots text[] not null default '{}',
  prep_minutes integer not null default 15,
  dietary_flags text[] not null default '{}',
  allergens text[] not null default '{}',
  source text not null default 'llm',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meal_concepts_source on public.meal_concepts (source);
create index if not exists idx_meal_concepts_protein_type on public.meal_concepts (protein_type);
create index if not exists idx_meal_concepts_slots on public.meal_concepts using gin (meal_slots);

create table if not exists public.user_meal_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references public.meal_concepts(id) on delete set null,
  meal_name text not null,
  protein_type text,
  date date not null,
  meal_slot text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_meal_history_user_date
  on public.user_meal_history (user_id, date desc);

alter table if exists public.user_preferences
  add column if not exists meals_per_day integer,
  add column if not exists max_prep_minutes integer,
  add column if not exists weekly_budget numeric,
  add column if not exists dietary_mode text,
  add column if not exists cuisine_preferences text[],
  add column if not exists health_conditions text[];

alter table if exists public.ingredients
  add column if not exists per_100g_iron_mg numeric,
  add column if not exists per_100g_omega_3_g numeric,
  add column if not exists per_100g_b12_mcg numeric,
  add column if not exists per_100g_vitamin_d_mcg numeric,
  add column if not exists per_100g_folate_mcg numeric,
  add column if not exists per_100g_calcium_mg numeric,
  add column if not exists per_100g_fibre numeric,
  add column if not exists verified boolean not null default true,
  add column if not exists source text not null default 'manual';
