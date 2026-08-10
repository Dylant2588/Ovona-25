-- Owner-scoped access for Ovona's authenticated application tables.
-- Existing policies are preserved; these named policies add missing operations.

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_allergies enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_logs enable row level security;
alter table public.plan_history enable row level security;
alter table public.ingredients enable row level security;
alter table public.meal_concepts enable row level security;
alter table public.user_meal_history enable row level security;

create policy "Ovona users can read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Ovona users can create own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Ovona users can read own preferences"
  on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);

create policy "Ovona users can create own preferences"
  on public.user_preferences for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Ovona users can update own preferences"
  on public.user_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Ovona users can read own allergies"
  on public.user_allergies for select to authenticated
  using (auth.uid() = user_id);

create policy "Ovona users can create own allergies"
  on public.user_allergies for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Ovona users can update own allergies"
  on public.user_allergies for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Ovona users can delete own allergies"
  on public.user_allergies for delete to authenticated
  using (auth.uid() = user_id);

create policy "Ovona users can read own meal plans"
  on public.meal_plans for select to authenticated
  using (auth.uid() = user_id);

create policy "Ovona users can create own meal plans"
  on public.meal_plans for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Ovona users can update own meal plans"
  on public.meal_plans for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Ovona users can delete own meal plans"
  on public.meal_plans for delete to authenticated
  using (auth.uid() = user_id);

create policy "Ovona users can read meal concepts"
  on public.meal_concepts for select to authenticated
  using (true);

create policy "Ovona users can create meal concepts"
  on public.meal_concepts for insert to authenticated
  with check (true);

create policy "Ovona users can read ingredients"
  on public.ingredients for select to authenticated
  using (true);

create policy "Ovona users can create ingredients"
  on public.ingredients for insert to authenticated
  with check (true);

create policy "Ovona users can read own meal history"
  on public.user_meal_history for select to authenticated
  using (auth.uid() = user_id);

create policy "Ovona users can create own meal history"
  on public.user_meal_history for insert to authenticated
  with check (auth.uid() = user_id);
