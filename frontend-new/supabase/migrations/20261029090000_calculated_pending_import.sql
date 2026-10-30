-- Service-only atomic pending ingestion. No approval or existing-version overwrite.
create or replace function public.import_pending_recipe_batch(p_records jsonb, p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  v_record jsonb;
  v_ingredient jsonb;
  v_count integer;
begin
  perform 1 from public.recipe_reviewer_roles where user_id = p_actor and role in ('reviewer', 'admin') for share;
  if not found then raise exception using errcode = '42501', message = 'reviewer_role_required'; end if;
  if jsonb_typeof(p_records) is distinct from 'array' or octet_length(p_records::text) > 1048576 then
    raise exception using errcode = '22023', message = 'invalid_import_batch';
  end if;
  v_count := jsonb_array_length(p_records);
  if v_count < 1 or v_count > 50 then raise exception using errcode = '22023', message = 'invalid_import_batch'; end if;
  if (select count(distinct jsonb_build_array(value->'id', value->'version')) from jsonb_array_elements(p_records)) <> v_count then
    raise exception using errcode = '22023', message = 'duplicate_import_identity';
  end if;
  -- Stable order avoids inverse-order multi-row submissions acquiring PK locks differently.
  for v_record in select value from jsonb_array_elements(p_records) order by value->>'id', value->>'version' loop
    if jsonb_typeof(v_record) is distinct from 'object' or jsonb_typeof(v_record->'id') is distinct from 'string' or
       length(trim(v_record->>'id')) = 0 or jsonb_typeof(v_record->'version') is distinct from 'number' or
       (v_record->>'version') !~ '^[1-9][0-9]{0,8}$' or
       v_record->'review' is distinct from '{"status":"pending_review","reviewedBy":null,"reviewedAt":null}'::jsonb or
       jsonb_typeof(v_record->'source') is distinct from 'object' or v_record->'source'->'reviewed' is distinct from 'false'::jsonb or
       jsonb_typeof(v_record->'source'->'reference') is distinct from 'string' or length(trim(v_record->'source'->>'reference')) = 0 or
       jsonb_typeof(v_record->'source'->'rights') is distinct from 'string' or length(trim(v_record->'source'->>'rights')) = 0 or
       jsonb_typeof(v_record->'nutrition') is distinct from 'object' or v_record->'nutrition'->'reviewed' is distinct from 'false'::jsonb or
       v_record->'nutrition'->>'method' is distinct from 'ingredient_calculated_v1' or
       jsonb_typeof(v_record->'nutrition'->'calculation') is distinct from 'object' or
       jsonb_typeof(v_record->'ingredients') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'invalid_pending_import';
    end if;
    if jsonb_array_length(v_record->'ingredients') < 1 or jsonb_array_length(v_record->'ingredients') > 500 then
      raise exception using errcode = '22023', message = 'invalid_pending_ingredients';
    end if;
    for v_ingredient in select value from jsonb_array_elements(v_record->'ingredients') loop
      if jsonb_typeof(v_ingredient) is distinct from 'object' or v_ingredient->'reviewed' is distinct from 'false'::jsonb then
        raise exception using errcode = '22023', message = 'pre_attested_import';
      end if;
    end loop;
    insert into public.recipe_library(id, version, record, review_status)
      values (v_record->>'id', (v_record->>'version')::integer, v_record, 'pending_review');
    insert into public.recipe_imports(recipe_id, recipe_version, source_reference, rights_declaration,
      payload_hash, imported_by, review_status, record)
      values (v_record->>'id', (v_record->>'version')::integer, v_record->'source'->>'reference',
        v_record->'source'->>'rights', encode(sha256(convert_to(v_record::text, 'UTF8')), 'hex'), p_actor,
        'pending_review', v_record);
  end loop;
  return jsonb_build_object('ok', true, 'imported', v_count);
end;
$$;
revoke all on function public.import_pending_recipe_batch(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.import_pending_recipe_batch(jsonb, uuid) to service_role;
