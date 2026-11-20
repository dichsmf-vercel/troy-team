-- Per-athlete coach toggles (owner request 2026-11-20). Additive only, safe to run on production.
--   selfie_required          : the athlete must upload a selfie before an exercise counts as done
--                              (assigned sessions and monthly-program sessions). Default off = optional.
--   show_upcoming_exercises  : the athlete may see the exercise list of future program sessions.
--                              Default off = future sessions show the date and exercise count only.
alter table public.athletes
  add column if not exists selfie_required boolean not null default false,
  add column if not exists show_upcoming_exercises boolean not null default false;
