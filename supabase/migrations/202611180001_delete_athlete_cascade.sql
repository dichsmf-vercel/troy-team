-- Atomic athlete deletion.
--
-- Replaces the app's 12 sequential DELETE calls with ONE transaction: if any step fails,
-- nothing is deleted. Storage files and the auth user are removed by the app AFTER this
-- function succeeds.
--
-- Run in the Supabase SQL editor BEFORE deploying the code that calls it (the app falls back to
-- the old sequential deletes until this exists).

create or replace function public.delete_athlete_cascade(p_athlete_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.athlete_assessment_answers
    where assessment_id in (select id from public.athlete_assessments where athlete_id = p_athlete_id);

  delete from public.exercise_completions
    where session_athlete_id in (select id from public.session_athletes where athlete_id = p_athlete_id);
  delete from public.session_selfies
    where session_athlete_id in (select id from public.session_athletes where athlete_id = p_athlete_id);
  delete from public.session_exercise_selfies where athlete_id = p_athlete_id;
  delete from public.program_exercise_selfies where athlete_id = p_athlete_id;

  delete from public.session_athletes where athlete_id = p_athlete_id;
  delete from public.session_posts where athlete_id = p_athlete_id;
  delete from public.athlete_programs where athlete_id = p_athlete_id;
  delete from public.athlete_assessments where athlete_id = p_athlete_id;
  delete from public.inbody_records where athlete_id = p_athlete_id;
  delete from public.measurements where athlete_id = p_athlete_id;
  delete from public.athlete_teams where athlete_id = p_athlete_id;
  delete from public.athletes where id = p_athlete_id;
  delete from public.profiles where id = p_athlete_id;
end;
$$;

-- Only the server (service role) may call it.
revoke all on function public.delete_athlete_cascade(uuid) from public, anon, authenticated;
grant execute on function public.delete_athlete_cascade(uuid) to service_role;
