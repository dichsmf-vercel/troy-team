-- ─────────────────────────────────────────────────────────────────────────────
-- session_exercise_selfies
-- One selfie per (session_athlete_id, session_exercise_id).
-- Files are stored in Supabase Storage bucket "session-selfies".
-- Rows older than 7 days are automatically deleted by a scheduled function.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.session_exercise_selfies (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references auth.users(id) on delete cascade,
  session_athlete_id  uuid not null,
  session_exercise_id uuid not null,
  storage_path        text not null,
  uploaded_at         timestamptz not null default now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid references auth.users(id),
  unique (session_athlete_id, session_exercise_id)
);

alter table public.session_exercise_selfies enable row level security;

-- Athletes can insert and view their own selfies
create policy "athletes manage their session exercise selfies"
  on public.session_exercise_selfies
  for all
  to authenticated
  using (auth.uid() = athlete_id)
  with check (auth.uid() = athlete_id);

-- Admins and supporting coaches can view and update (mark reviewed)
create policy "admins view session exercise selfies"
  on public.session_exercise_selfies
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'supporting_coach')
    )
  );

create policy "admins delete session exercise selfies"
  on public.session_exercise_selfies
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'supporting_coach')
    )
  );

create policy "admins update session exercise selfies"
  on public.session_exercise_selfies
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'supporting_coach')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'supporting_coach')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket: session-selfies (private)
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-selfies',
  'session-selfies',
  false,
  8388608, -- 8 MB
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do nothing;

-- Athletes upload to their own folder (path starts with their user id)
create policy "athletes upload session selfies"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'session-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "athletes view own session selfies"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'session-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins view all session selfies"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'session-selfies'
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'supporting_coach')
    )
  );

create policy "admins delete session selfies"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'session-selfies'
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'supporting_coach')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-cleanup: delete selfies (DB rows + storage files) older than 7 days.
-- Uses pg_cron (available on Supabase). Runs daily at 03:00 UTC.
-- The storage.delete() helper removes the file; deleting the DB row cascades
-- from the unique constraint.  We use a DO block so it is safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pg_cron extension if not already enabled (requires pg_cron in extensions)
-- create extension if not exists pg_cron;

-- Create the cleanup function
create or replace function public.cleanup_old_session_selfies()
returns void
language plpgsql
security definer
as $$
declare
  selfie record;
begin
  for selfie in
    select id, storage_path
    from public.session_exercise_selfies
    where reviewed_at is null
      and uploaded_at < now() - interval '7 days'
  loop
    -- Delete from storage
    perform storage.delete('session-selfies', selfie.storage_path);
    -- Delete DB row
    delete from public.session_exercise_selfies where id = selfie.id;
  end loop;
end;
$$;

-- Schedule the cleanup daily at 03:00 UTC (uncomment after enabling pg_cron)
-- select cron.schedule(
--   'cleanup-old-session-selfies',
--   '0 3 * * *',
--   $$ select public.cleanup_old_session_selfies(); $$
-- );

-- NOTE: To enable automatic 7-day cleanup:
-- 1. Enable pg_cron in your Supabase project (Database → Extensions → pg_cron)
-- 2. Uncomment the two blocks above (create extension + cron.schedule)
-- 3. Re-run this migration or execute the cron.schedule call manually in the SQL editor
