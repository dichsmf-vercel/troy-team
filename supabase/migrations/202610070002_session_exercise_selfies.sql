-- ─────────────────────────────────────────────────────────────────────────────
-- session_exercise_selfies
-- One selfie per (session_athlete_id, session_exercise_id).
-- Files are stored in Supabase Storage bucket "session-selfies".
-- Rows older than 7 days are automatically deleted by the cleanup function.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.session_exercise_selfies (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references auth.users(id) on delete cascade,
  session_athlete_id  uuid not null references public.session_athletes(id) on delete cascade,
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  storage_path        text not null,
  uploaded_at         timestamptz not null default now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid references auth.users(id),
  unique (session_athlete_id, session_exercise_id)
);

alter table public.session_exercise_selfies enable row level security;

create policy "athletes manage their session exercise selfies"
  on public.session_exercise_selfies for all to authenticated
  using (auth.uid() = athlete_id)
  with check (auth.uid() = athlete_id);

create policy "admins view session exercise selfies"
  on public.session_exercise_selfies for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'supporting_coach')));

create policy "admins delete session exercise selfies"
  on public.session_exercise_selfies for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'supporting_coach')));

create policy "admins update session exercise selfies"
  on public.session_exercise_selfies for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'supporting_coach')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'supporting_coach')));

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket: session-selfies (private, 8 MB limit)
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-selfies', 'session-selfies', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "athletes upload session selfies"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'session-selfies' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "athletes view own session selfies"
  on storage.objects for select to authenticated
  using (bucket_id = 'session-selfies' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "admins view all session selfies"
  on storage.objects for select to authenticated
  using (bucket_id = 'session-selfies' and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'supporting_coach')));

create policy "admins delete session selfies"
  on storage.objects for delete to authenticated
  using (bucket_id = 'session-selfies' and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'supporting_coach')));

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-cleanup: delete selfies older than 7 days (unreviewed)
-- Enable pg_cron in Supabase (Database > Extensions) then uncomment the schedule
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.cleanup_old_session_selfies()
returns void language plpgsql security definer as $$
declare
  r record;
begin
  for r in
    select id, storage_path from public.session_exercise_selfies
    where reviewed_at is null and uploaded_at < now() - interval '7 days'
  loop
    perform storage.delete('session-selfies', r.storage_path);
    delete from public.session_exercise_selfies where id = r.id;
  end loop;
end;
$$;

-- Uncomment after enabling pg_cron extension:
-- select cron.schedule('cleanup-old-session-selfies', '0 3 * * *', $$ select public.cleanup_old_session_selfies(); $$);
