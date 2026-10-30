-- Atomic review transitions. Apply only through an explicitly selected migration target.
create table if not exists public.recipe_review_events (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null,
  draft_version integer not null check (draft_version > 0),
  approved_version integer,
  action text not null check (action in ('approve', 'reject')),
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null,
  attestations jsonb not null,
  recipe_import_id uuid references public.recipe_imports(id) on delete restrict,
  original_importer_id uuid references auth.users(id) on delete restrict,
  original_payload_hash text,
  draft_hash text not null check (draft_hash ~ '^[a-f0-9]{64}$'),
  draft_snapshot jsonb not null,
  provenance_kind text not null check (provenance_kind in ('imported', 'legacy_review_snapshot')),
  foreign key (recipe_id, draft_version) references public.recipe_library(id, version) on delete restrict,
  foreign key (recipe_id, approved_version) references public.recipe_library(id, version) on delete restrict,
  unique (recipe_id, draft_version),
  check ((action = 'approve' and approved_version = draft_version + 1) or
         (action = 'reject' and approved_version is null)),
  check ((provenance_kind = 'imported' and recipe_import_id is not null and original_importer_id is not null and original_payload_hash is not null) or
         (provenance_kind = 'legacy_review_snapshot' and recipe_import_id is null and original_importer_id is null and original_payload_hash is null))
);
alter table public.recipe_review_events enable row level security;
revoke all on public.recipe_review_events from public, anon, authenticated, service_role;
grant select, insert on public.recipe_review_events to service_role;

create or replace function public.protect_recipe_review_event()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception using errcode = '42501', message = 'Recipe review events are append-only';
end;
$$;
revoke all on function public.protect_recipe_review_event() from public, anon, authenticated;
drop trigger if exists protect_recipe_review_event on public.recipe_review_events;
create trigger protect_recipe_review_event before update or delete on public.recipe_review_events
  for each row execute function public.protect_recipe_review_event();

create or replace function public.review_recipe_version(
  p_recipe_id text, p_expected_version integer, p_expected_pending jsonb,
  p_proposed_record jsonb, p_action text, p_actor uuid, p_attestations jsonb
) returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  v_pending public.recipe_library%rowtype;
  v_import public.recipe_imports%rowtype;
  v_expected jsonb;
  v_closed jsonb;
  v_reviewed_at timestamptz := clock_timestamp();
  v_approved_version integer;
  v_import_found boolean := false;
begin
  -- EXECUTE is service-only; actor is independently verified by the server route.
  -- Recheck the current role assignment transactionally before touching recipe data.
  perform 1 from public.recipe_reviewer_roles where user_id = p_actor and role in ('reviewer', 'admin') for share;
  if not found then
    raise exception using errcode = '42501', message = 'reviewer_role_required';
  end if;
  if p_recipe_id is null or length(trim(p_recipe_id)) = 0 or p_expected_version is null or
     p_expected_version < 1 or p_action is null or p_action not in ('approve', 'reject') or
     jsonb_typeof(p_expected_pending) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_review_request';
  end if;
  select * into v_pending from public.recipe_library
    where id = p_recipe_id and version = p_expected_version for update;
  if not found or v_pending.review_status <> 'pending_review' or
     v_pending.record is distinct from p_expected_pending then
    raise exception using errcode = 'P0002', message = 'review_conflict';
  end if;
  if v_pending.record->'review' is distinct from jsonb_build_object(
      'status', 'pending_review', 'reviewedBy', null, 'reviewedAt', null) then
    raise exception using errcode = '22023', message = 'invalid_pending_review';
  end if;
  if p_action = 'approve' then
    if jsonb_typeof(p_attestations) is distinct from 'object' or
       p_attestations is distinct from '{"source":true,"rights":true,"ingredients":true,"nutrition":true,"cooked":true}'::jsonb or
       jsonb_typeof(p_proposed_record) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'review_attestations_required';
    end if;
    if p_proposed_record->'review'->>'status' is distinct from 'approved' or
       p_proposed_record->'review'->>'reviewedBy' is distinct from p_actor::text or
       jsonb_typeof(p_proposed_record->'review'->'reviewedAt') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'invalid_review_attribution';
    end if;
    v_reviewed_at := (p_proposed_record->'review'->>'reviewedAt')::timestamptz;
    if not isfinite(v_reviewed_at) then
      raise exception using errcode = '22023', message = 'invalid_review_time';
    end if;
    v_approved_version := p_expected_version + 1;
    v_expected := v_pending.record || jsonb_build_object(
      'version', v_approved_version,
      'review', jsonb_build_object('status', 'approved', 'reviewedBy', p_actor::text,
        'reviewedAt', p_proposed_record->'review'->>'reviewedAt'),
      'source', (v_pending.record->'source') || '{"reviewed":true}'::jsonb,
      'nutrition', (v_pending.record->'nutrition') || '{"reviewed":true}'::jsonb,
      'ingredients', (select jsonb_agg(value || '{"reviewed":true}'::jsonb order by ordinality)
        from jsonb_array_elements(v_pending.record->'ingredients') with ordinality)
    );
    if p_proposed_record is distinct from v_expected then
      raise exception using errcode = '22023', message = 'review_content_changed';
    end if;
    if exists (select 1 from public.recipe_library where id = p_recipe_id and version = v_approved_version) then
      raise exception using errcode = 'P0002', message = 'review_conflict';
    end if;
    insert into public.recipe_library(id, version, record, review_status)
      values (p_recipe_id, v_approved_version, p_proposed_record, 'approved');
  else
    if p_proposed_record is not null or p_attestations is distinct from '{}'::jsonb then
      raise exception using errcode = '22023', message = 'invalid_rejection';
    end if;
  end if;

  -- Match a real original import, never invent importer/hash attribution for legacy drafts.
  select * into v_import from public.recipe_imports
    where recipe_id = p_recipe_id and recipe_version = p_expected_version and record = v_pending.record
    order by imported_at, id limit 1 for share;
  v_import_found := found;
  v_closed := v_pending.record || jsonb_build_object('review', jsonb_build_object(
    'status', 'rejected', 'reviewedBy', p_actor::text, 'reviewedAt', v_reviewed_at));
  update public.recipe_library set record = v_closed, review_status = 'rejected', updated_at = v_reviewed_at
    where id = p_recipe_id and version = p_expected_version;
  insert into public.recipe_review_events(recipe_id, draft_version, approved_version, action, reviewer_id,
    reviewed_at, attestations, recipe_import_id, original_importer_id, original_payload_hash,
    draft_hash, draft_snapshot, provenance_kind)
  values (p_recipe_id, p_expected_version, v_approved_version, p_action, p_actor, v_reviewed_at, p_attestations,
    case when v_import_found then v_import.id end,
    case when v_import_found then v_import.imported_by end,
    case when v_import_found then v_import.payload_hash end,
    encode(sha256(convert_to(v_pending.record::text, 'UTF8')), 'hex'), v_pending.record,
    case when v_import_found then 'imported' else 'legacy_review_snapshot' end);
  return jsonb_build_object('ok', true, 'status', case when p_action = 'approve' then 'approved' else 'rejected' end,
    'version', v_approved_version);
end;
$$;
revoke all on function public.review_recipe_version(text, integer, jsonb, jsonb, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.review_recipe_version(text, integer, jsonb, jsonb, text, uuid, jsonb) to service_role;
