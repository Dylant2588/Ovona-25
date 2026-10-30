-- Synthetic failure injection only, applied after the fresh disposable-target guard.
-- No application or production fixture is read, repaired or removed.
create or replace function public.baseline_test_reject_fixture_write()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_table_name = 'recipe_review_events' and to_jsonb(new)->>'recipe_id' = 'baseline-event-failure' then
    raise exception 'Synthetic review event failure' using errcode = '23514';
  end if;
  if tg_table_name = 'user_allergies' and to_jsonb(new)->>'allergy_name' = 'baseline-fail-allergy' then
    raise exception 'Synthetic allergy insertion failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.baseline_test_reject_fixture_write() from public, anon, authenticated, service_role;
create trigger baseline_test_event_failure before insert on public.recipe_review_events
  for each row when (new.recipe_id = 'baseline-event-failure')
  execute function public.baseline_test_reject_fixture_write();
create trigger baseline_test_allergy_failure before insert on public.user_allergies
  for each row when (new.allergy_name = 'baseline-fail-allergy')
  execute function public.baseline_test_reject_fixture_write();
