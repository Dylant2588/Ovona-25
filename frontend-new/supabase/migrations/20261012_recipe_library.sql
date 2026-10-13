-- Additive structured recipe library. Review writes are administration only.
create table if not exists public.recipe_library (
  id text not null,
  version integer not null check (version > 0),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  review_status text not null default 'pending_review' check (review_status in ('pending_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, version),
  constraint recipe_identity_matches check (coalesce(record->>'id' = id and (record->>'version')::integer = version, false)),
  constraint recipe_review_matches check (coalesce(record->'review'->>'status' = review_status, false)),
  constraint recipe_approved_metadata check (review_status <> 'approved' or (
    coalesce(record->'source'->>'reviewed', 'false') = 'true' and
    coalesce(record->'nutrition'->>'reviewed', 'false') = 'true' and
    length(coalesce(record->'review'->>'reviewedBy', '')) > 0 and
    length(coalesce(record->'review'->>'reviewedAt', '')) > 0
  ))
);
alter table public.recipe_library enable row level security;
revoke all on public.recipe_library from anon, authenticated;
grant select on public.recipe_library to authenticated;
grant all on public.recipe_library to service_role;
drop policy if exists recipe_library_reviewed_read on public.recipe_library;
create policy recipe_library_reviewed_read on public.recipe_library for select to authenticated using (review_status = 'approved');
create index if not exists recipe_library_review_status_idx on public.recipe_library(review_status);

create or replace function public.protect_approved_recipe_version() returns trigger language plpgsql set search_path = public as $$
begin
  if old.review_status = 'approved' then
    if new.id <> old.id or new.version <> old.version or
      (new.record - 'review') is distinct from (old.record - 'review') or
      new.review_status not in ('approved', 'rejected') or
      (new.review_status = 'approved' and new.record is distinct from old.record) then
      raise exception 'Approved recipe versions are immutable; create a new version or revoke review';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_approved_recipe_version on public.recipe_library;
create trigger protect_approved_recipe_version before update on public.recipe_library for each row execute function public.protect_approved_recipe_version();
