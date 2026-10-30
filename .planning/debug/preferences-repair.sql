-- Minimal repair for the configured Ovona project.
-- Defines the tested owner-scoped preference functions only.
-- No table changes and no call to save_safety_preferences; existing rows are not rewritten.
-- Apply as the project database administrator in the Supabase SQL editor.
begin;
-- Owner-scoped, all-or-nothing preference persistence. Apply only after the
-- baseline and structured-planning migrations. No legacy reduced-payload path.
create or replace function public.baseline_preference_terms(p_value jsonb)
returns text[] language plpgsql immutable set search_path = pg_catalog as $$
declare v_values text[]; v_item jsonb;
begin
  if p_value is null or p_value = 'null'::jsonb then return '{}'::text[]; end if;
  if jsonb_typeof(p_value) = 'string' then
    v_values := regexp_split_to_array(p_value #>> '{}', E'[,;\n]');
  elsif jsonb_typeof(p_value) = 'array' then
    for v_item in select value from jsonb_array_elements(p_value) loop
      if jsonb_typeof(v_item) <> 'string' or btrim(v_item #>> '{}') = '' then
        raise exception 'Invalid saved preference terms' using errcode = '22023';
      end if;
    end loop;
    select coalesce(array_agg(value), '{}'::text[]) into v_values from jsonb_array_elements_text(p_value);
  else
    raise exception 'Invalid saved preference terms' using errcode = '22023';
  end if;
  return array(select distinct lower(regexp_replace(btrim(t), '\s+', ' ', 'g'))
    from unnest(v_values) t where btrim(t) <> '' order by 1);
end;
$$;
revoke all on function public.baseline_preference_terms(jsonb) from public, anon, authenticated, service_role;

create or replace function public.save_safety_preferences(p_patch jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  v_owner uuid := auth.uid();
  v_pref public.user_preferences%rowtype;
  v_profile public.profiles%rowtype;
  v_profile_patch jsonb := '{}'::jsonb;
  v_pref_patch jsonb;
  v_allergies text[];
  v_key text;
  v_item jsonb;
  v_terms text[];
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Preference patch must be an object' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k where k not in (
    'allergies','dislikes','cuisines','taste_preferences','never_foods','food_likes',
    'max_prep_minutes','dietary_mode','goal','meal_complexity',
    'target_calories','target_protein','target_carbs','target_fat','profile')) then
    raise exception 'Unsupported preference field' using errcode = '22023';
  end if;
  -- Validate even direct PostgREST callers, not just the TypeScript route.
  foreach v_key in array array['allergies','dislikes','cuisines','taste_preferences','never_foods','food_likes'] loop
    if p_patch ? v_key then
      if jsonb_typeof(p_patch->v_key) <> 'array' or jsonb_array_length(p_patch->v_key) > 40 then
        raise exception 'Preference lists must be arrays of at most 40 terms' using errcode = '22023';
      end if;
      for v_item in select value from jsonb_array_elements(p_patch->v_key) loop
        if jsonb_typeof(v_item) <> 'string' or length(btrim(v_item #>> '{}')) = 0 or length(v_item #>> '{}') > 160 then
          raise exception 'Invalid preference term' using errcode = '22023';
        end if;
      end loop;
      p_patch := jsonb_set(p_patch, array[v_key], to_jsonb(public.baseline_preference_terms(p_patch->v_key)));
    end if;
  end loop;
  if p_patch ? 'max_prep_minutes' and (
    jsonb_typeof(p_patch->'max_prep_minutes') <> 'number' or
    (p_patch->>'max_prep_minutes')::numeric < 1 or
    (p_patch->>'max_prep_minutes')::numeric > 240 or
    trunc((p_patch->>'max_prep_minutes')::numeric) <> (p_patch->>'max_prep_minutes')::numeric) then
    raise exception 'Invalid preparation limit' using errcode = '22023';
  end if;
  if p_patch ? 'dietary_mode' and p_patch->'dietary_mode' <> 'null'::jsonb and
    (jsonb_typeof(p_patch->'dietary_mode') <> 'string' or p_patch->>'dietary_mode' not in ('vegan','vegetarian','pescatarian','low_carb','high_protein')) then
    raise exception 'Invalid dietary mode' using errcode = '22023';
  end if;
  if p_patch ? 'goal' and (jsonb_typeof(p_patch->'goal') <> 'string' or p_patch->>'goal' not in ('lose_weight','gain','maintain','recomp')) then
    raise exception 'Invalid goal' using errcode = '22023';
  end if;
  if p_patch ? 'meal_complexity' and (jsonb_typeof(p_patch->'meal_complexity') <> 'string' or p_patch->>'meal_complexity' not in ('simple','normal','adventurous')) then
    raise exception 'Invalid complexity' using errcode = '22023';
  end if;
  foreach v_key in array array['target_calories','target_protein','target_carbs','target_fat'] loop
    if p_patch ? v_key and p_patch->v_key <> 'null'::jsonb then
      if jsonb_typeof(p_patch->v_key) <> 'number' or
        (p_patch->>v_key)::numeric < (case when v_key in ('target_calories','target_protein') then 1 else 0 end) or
        (p_patch->>v_key)::numeric > (case when v_key = 'target_calories' then 10000 else 2000 end) then
        raise exception 'Invalid macro target' using errcode = '22023';
      end if;
    end if;
  end loop;
  if p_patch ? 'profile' then
    if jsonb_typeof(p_patch->'profile') <> 'object' then raise exception 'Invalid profile patch' using errcode = '22023'; end if;
    v_profile_patch := p_patch->'profile';
    if exists (select 1 from jsonb_object_keys(v_profile_patch) k where k not in ('email','body_weight_kg','height_cm','activity_level','notes')) then
      raise exception 'Unsupported profile field' using errcode = '22023';
    end if;
    foreach v_key in array array['email','notes','activity_level'] loop
      if v_profile_patch ? v_key and v_profile_patch->v_key <> 'null'::jsonb and
        (jsonb_typeof(v_profile_patch->v_key) <> 'string' or length(v_profile_patch->>v_key) > (case when v_key = 'notes' then 10000 when v_key = 'email' then 320 else 30 end)) then
        raise exception 'Invalid profile text' using errcode = '22023';
      end if;
    end loop;
    if v_profile_patch ? 'activity_level' and v_profile_patch->'activity_level' <> 'null'::jsonb and
      v_profile_patch->>'activity_level' not in ('sedentary','light','moderate','intense') then
      raise exception 'Invalid activity level' using errcode = '22023';
    end if;
    foreach v_key in array array['body_weight_kg','height_cm'] loop
      if v_profile_patch ? v_key and v_profile_patch->v_key <> 'null'::jsonb and
        (jsonb_typeof(v_profile_patch->v_key) <> 'number' or (v_profile_patch->>v_key)::numeric < 1 or
         (v_profile_patch->>v_key)::numeric > (case when v_key = 'height_cm' then 300 else 1000 end)) then
        raise exception 'Invalid body measurement' using errcode = '22023';
      end if;
    end loop;
  end if;
  -- A missing deployment contract fails before any mutation, never by dropping
  -- unsupported hard exclusions. The route maps 42703 to actionable HTTP 503.
  if exists (select 1 from (values
      ('user_preferences','never_foods'), ('user_preferences','food_likes'),
      ('user_preferences','max_prep_minutes'), ('user_preferences','dietary_mode'),
      ('user_allergies','allergy_name')) required(table_name,column_name)
    where not exists (select 1 from information_schema.columns c where c.table_schema = 'public'
      and c.table_name = required.table_name and c.column_name = required.column_name)) then
    raise exception 'Unsupported safety preference schema' using errcode = '42703';
  end if;
  -- Row locks alone do not serialize first-time users whose rows do not exist.
  perform pg_advisory_xact_lock(hashtextextended('ovona:safety-preferences:' || v_owner::text, 0));
  insert into public.profiles(id) values(v_owner) on conflict(id) do nothing;
  insert into public.user_preferences(user_id) values(v_owner) on conflict(user_id) do nothing;
  select * into strict v_profile from public.profiles where id = v_owner for update;
  select * into strict v_pref from public.user_preferences where user_id = v_owner for update;
  perform 1 from public.user_allergies where user_id = v_owner for update;
  if exists(select 1 from public.user_allergies where user_id = v_owner and (allergy_name is null or btrim(allergy_name) = '')) then
    raise exception 'A saved allergy requires review' using errcode = '22023';
  end if;
  select array(select distinct term from unnest(
    public.baseline_preference_terms(to_jsonb(v_profile.allergies)) ||
    public.baseline_preference_terms(to_jsonb(v_pref.allergies)) ||
    public.baseline_preference_terms(p_patch->'allergies') ||
    coalesce((select array_agg(lower(btrim(allergy_name))) from public.user_allergies where user_id = v_owner), '{}'::text[])
  ) term where term <> '' order by term) into v_allergies;
  -- Preserve existing allergy rows/severity: this phase does not add removals.
  -- Add missing union terms in the same transaction; any insert failure rolls
  -- back profile and preference writes as well.
  insert into public.user_allergies(user_id,allergy_name)
    select v_owner,term from unnest(v_allergies) term
    where not exists(select 1 from public.user_allergies a where a.user_id = v_owner and lower(btrim(a.allergy_name)) = term);
  v_profile_patch := v_profile_patch || jsonb_build_object('allergies',v_allergies);
  if p_patch ? 'dislikes' then v_profile_patch := v_profile_patch || jsonb_build_object('dislikes',p_patch->'dislikes'); end if;
  if p_patch ? 'cuisines' then v_profile_patch := v_profile_patch || jsonb_build_object('cuisines',p_patch->'cuisines'); end if;
  v_profile := jsonb_populate_record(v_profile,v_profile_patch);
  update public.profiles set email=v_profile.email, body_weight_kg=v_profile.body_weight_kg,
    height_cm=v_profile.height_cm,activity_level=v_profile.activity_level,notes=v_profile.notes,
    allergies=v_profile.allergies,dislikes=v_profile.dislikes,cuisines=v_profile.cuisines,updated_at=now()
    where id=v_owner;
  v_pref_patch := p_patch - array['profile','allergies','dislikes','cuisines'];
  v_pref_patch := v_pref_patch || jsonb_build_object('allergies',array_to_string(v_allergies,', '));
  if p_patch ? 'cuisines' then
    v_terms := public.baseline_preference_terms(p_patch->'cuisines');
    v_pref_patch := v_pref_patch || jsonb_build_object('cuisines',array_to_string(v_terms,', '),'cuisine_preferences',v_terms);
  end if;
  if p_patch ? 'dietary_mode' then v_pref_patch := v_pref_patch || jsonb_build_object('lifestyle',p_patch->'dietary_mode'); end if;
  v_pref := jsonb_populate_record(v_pref,v_pref_patch);
  update public.user_preferences set allergies=v_pref.allergies,cuisines=v_pref.cuisines,
    cuisine_preferences=v_pref.cuisine_preferences,taste_preferences=v_pref.taste_preferences,
    never_foods=v_pref.never_foods,food_likes=v_pref.food_likes,max_prep_minutes=v_pref.max_prep_minutes,
    dietary_mode=v_pref.dietary_mode,lifestyle=v_pref.lifestyle,goal=v_pref.goal,meal_complexity=v_pref.meal_complexity,
    target_calories=v_pref.target_calories,target_protein=v_pref.target_protein,
    target_carbs=v_pref.target_carbs,target_fat=v_pref.target_fat,updated_at=now()
    where user_id=v_owner;
  return jsonb_build_object('ok',true,'profileSaved',true,'allergiesSynced',true);
end;
$$;
revoke all on function public.save_safety_preferences(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_safety_preferences(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
select to_regprocedure('public.save_safety_preferences(jsonb)') is not null as preference_function_installed;