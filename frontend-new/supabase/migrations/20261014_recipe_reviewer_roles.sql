-- Recipe review is an internal operational role, never a hard-coded email.
-- The service-role API checks this table for the authenticated user's id.
create table if not exists public.recipe_reviewer_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('reviewer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipe_reviewer_roles enable row level security;
revoke all on public.recipe_reviewer_roles from anon, authenticated;
grant all on public.recipe_reviewer_roles to service_role;

create index if not exists recipe_reviewer_roles_role_idx
  on public.recipe_reviewer_roles(role);
