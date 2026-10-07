create table if not exists public.program_exercise_selfies (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  athlete_program_id uuid not null,
  session_date date not null,
  exercise_index integer not null check (exercise_index >= 0),
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (athlete_id, athlete_program_id, session_date, exercise_index)
);

alter table public.program_exercise_selfies enable row level security;
create policy "athletes manage their exercise selfies" on public.program_exercise_selfies for all to authenticated using (auth.uid() = athlete_id) with check (auth.uid() = athlete_id);
create policy "admins review exercise selfies" on public.program_exercise_selfies for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "admins review and delete exercise selfies" on public.program_exercise_selfies for update to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

insert into storage.buckets (id, name, public) values ('exercise-selfies', 'exercise-selfies', false) on conflict (id) do nothing;
create policy "athletes upload exercise selfies" on storage.objects for insert to authenticated with check (bucket_id = 'exercise-selfies' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "athletes view own exercise selfies" on storage.objects for select to authenticated using (bucket_id = 'exercise-selfies' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "admins view exercise selfies" on storage.objects for select to authenticated using (bucket_id = 'exercise-selfies' and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "admins delete exercise selfies" on storage.objects for delete to authenticated using (bucket_id = 'exercise-selfies' and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
