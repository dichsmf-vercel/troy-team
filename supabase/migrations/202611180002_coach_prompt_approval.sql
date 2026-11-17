-- Human approval for AI-proposed coach system prompts.
--
-- After a coach edits an AI program, the AI proposes a prompt improvement. It is stored as
-- 'pending' and only used for generation once an admin approves it ('active').
-- Existing rows stay 'active', so current behaviour does not change.
--
-- Run in the Supabase SQL editor BEFORE deploying the code that uses it.

alter table public.coach_system_prompts
  add column if not exists status text not null default 'active',
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz;

alter table public.coach_system_prompts
  drop constraint if exists coach_system_prompts_status_check;
alter table public.coach_system_prompts
  add constraint coach_system_prompts_status_check check (status in ('pending', 'active', 'rejected'));

create index if not exists coach_system_prompts_status_version_idx
  on public.coach_system_prompts (status, version desc);
