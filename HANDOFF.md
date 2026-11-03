# Troy Team — Dev Handoff

Last updated: October 2026

---

## ⚠️ Uncommitted changes (local only — not yet pushed)

These files are modified but not committed. Run the SQL block below, then commit and push.

| File | What changed |
|---|---|
| `app/admin/actions.ts` | `createAthleteAccount` rewritten (Troy ID, no email, forced password change); `generateTemporaryAthletePassword` re-sets `password_change_required` flag |
| `app/auth/login/page.tsx` | Accepts Troy ID (TROY-XXXXXXX) or email; resolves Troy ID to internal fake email before signing in; checks `password_change_required` after login |
| `app/auth/set-password/page.tsx` | Handles `?forced=1` param, shows warning banner, clears `password_change_required` on save |
| `lib/supabase/proxy.ts` | Middleware now reads `password_change_required` from profile and redirects to `/auth/set-password?forced=1` on any protected route |
| `components/admin/athlete-create-form.tsx` | No email field; FMS fields use Arabic label dropdowns (0–3); Strength fields take kg+reps and compute Epley 1RM live; shows Troy ID + temp password after creation with copy buttons |
| `lib/troy-id.ts` | New utility: `generateTroyId()`, `troyIdToEmail()`, `isTroyId()` |

---

## 🗄️ SQL to run in Supabase (all at once, before deploying the uncommitted changes)

```sql
-- New athlete columns
alter table public.athletes
  add column if not exists sport text,
  add column if not exists position text,
  add column if not exists birth_year integer,
  add column if not exists free_training_days integer[] default '{}',
  add column if not exists show_exercise_recap boolean not null default true;

-- Goal column on programs
alter table public.athlete_programs
  add column if not exists goal text;

-- Troy ID + forced password flag on profiles
alter table public.profiles
  add column if not exists troy_id text unique,
  add column if not exists password_change_required boolean not null default false;

create index if not exists profiles_troy_id_idx on public.profiles(troy_id);

-- Coach system prompt versioning
create table if not exists public.coach_system_prompts (
  id uuid primary key default gen_random_uuid(),
  version integer not null,
  prompt_text text not null,
  change_summary text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.coach_system_prompts enable row level security;
create policy "admins manage system prompts"
  on public.coach_system_prompts for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')));

-- System event / error log
create table if not exists public.system_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.system_log enable row level security;
create policy "admins view system log"
  on public.system_log for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')));
create policy "service role insert system log"
  on public.system_log for insert to authenticated
  with check (true);

-- Assessment form schema versioning
create table if not exists public.assessment_form_schema (
  id uuid primary key default gen_random_uuid(),
  version integer not null,
  schema_json jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.assessment_form_schema enable row level security;
create policy "admins manage assessment schema"
  on public.assessment_form_schema for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')));

-- session_exercise_selfies (if not already created from previous migration)
create table if not exists public.session_exercise_selfies (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  session_athlete_id uuid not null references public.session_athletes(id) on delete cascade,
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (session_athlete_id, session_exercise_id)
);
alter table public.session_exercise_selfies enable row level security;
create policy "athletes manage their session exercise selfies"
  on public.session_exercise_selfies for all to authenticated
  using (auth.uid() = athlete_id) with check (auth.uid() = athlete_id);
create policy "admins view session exercise selfies"
  on public.session_exercise_selfies for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')));
create policy "admins delete session exercise selfies"
  on public.session_exercise_selfies for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')));

-- session-selfies storage bucket
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
  using (bucket_id = 'session-selfies' and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')));
create policy "admins delete session selfies"
  on storage.objects for delete to authenticated
  using (bucket_id = 'session-selfies' and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')));
```

---

## ✅ Shipped to production (pushed to main)

### Assigned sessions — athlete side
- Full rewrite of `SessionRunner`: step-by-step UI, numbered nav pills, auto-advance on complete, prev/next buttons, inline errors
- Pre-start screen shows exercise count and selfie requirement
- Done screen routes to session summary

### Per-exercise selfie system
- One selfie required per exercise before marking complete (UI-enforced)
- Files stored in Supabase Storage (`session-selfies` bucket) — no more base64 in DB
- `uploadExerciseSelfie` server action with 8MB limit, file validation, storage upload, DB upsert with cleanup on failure
- Auto-cleanup SQL function (`cleanup_old_session_selfies`) deletes files + rows older than 7 days — needs pg_cron enabled in Supabase to schedule

### Admin selfie inbox
- `reviewSessionSelfie` action added (was broken import crashing the component before)
- Admin page fetches both `program_exercise_selfies` and `session_exercise_selfies`, generates signed URLs for both
- Inbox in Athletes tab shows both selfie types with correct review action per type

### Admin Feedback tab
- New 6th tab in admin: "Feedback"
- Shows session summaries (RPE, overall rating, soreness, sleep, symptoms, written feedback) per athlete
- Shows pain reports per athlete (exercise name, location, severity/10, notes)
- Red badge on tab with unread pain report count
- Collapsible per-athlete cards with averages in header
- Search by athlete name

### Dashboard fixes
- Upcoming sessions count was rendering array object instead of `.length` — fixed
- `session_exercises` RLS was blocking `startSession` — removed the count check from the server action

### Console diagnostics
- `[session-debug]` logs throughout the session flow (dashboard load, card click, runner mount, start, selfie upload, exercise complete)
- All logs use `console.groupCollapsed` for clean DevTools output

---

## 🔨 Items completed in local (not yet committed/pushed)

**Item 1 — Troy ID login system**
- `lib/troy-id.ts`: `generateTroyId()` (format `TROY-XXXXXXX`, no confusable chars), `troyIdToEmail()` (maps to `troy-xxxxxxx@troy.internal`), `isTroyId()`
- Login page accepts Troy ID or email, resolves to internal email before Supabase auth call
- After login checks `password_change_required` flag and redirects if set

**Item 2 — Forced password change**
- Middleware (`proxy.ts`) intercepts any protected route when `password_change_required = true` and redirects to `/auth/set-password?forced=1`
- Set-password page shows forced-mode banner, clears flag after save
- `generateTemporaryAthletePassword` now also sets `password_change_required = true`

**Item 3 — Athlete creation redesign**
- Email field removed entirely
- Troy ID + temp password shown after creation with one-click copy buttons
- FMS fields changed to Arabic label dropdowns: `0 – ضعيف جدا`, `1 – ضعيف`, `2 – جيد/متوسط`, `3 – ممتاز`
- Strength section takes kg + reps per lift, shows live Epley 1RM estimate, submits estimated 1RM
- New fields: sport, position, birth year

---

## ✅ Also completed (item 4 — athlete tab redesign)

### Athlete tab redesign
- `components/admin/athlete-drawer.tsx` — new Sheet drawer component for per-athlete view. Shows: quick stats (height, weight, BMI, sport, position, birth year, team, tier, assessment), Troy ID credentials with copy button, `password_change_required` badge, exercise selfies gallery (both types, inline review), collapsible session feedback (pain reports + session summaries), collapsible settings section, account controls (temp password, pause/resume, delete).
- `components/admin/athletes-panel.tsx` — replaced dense card grid with a clean list of rows. Each row shows name, Troy ID / email, team, sport, and inline badges for paused/unread selfies/pain reports/assessment status. Clicking any row opens the drawer. All actions (password reset, pause, delete, settings) moved into the drawer where they belong.
- `app/admin/actions.ts` — added `updateAthleteSettings` (writes `free_training_days`, `show_exercise_recap`, `sport`, `position`, `birth_year`). Accepts multiple checkbox values via `form.getAll("free_training_days")`.
- `app/admin/page.tsx` — extended `athletes` query to include `sport, position, birth_year, free_training_days, show_exercise_recap`; extended `profiles` query to include `troy_id, password_change_required`.
- `components/admin/admin-board.tsx` — `AthletesWorkspace` now passes `feedbackSummaries` and `feedbackPainReports` down to `AthletesPanel` so the drawer can show per-athlete feedback inline.

---

## 📋 Remaining build order

Work through these in order — each unblocks the next.

### ~~4. Athlete tab redesign~~ ✅ Done
Full per-athlete page/drawer with: selfies gallery, session feedback, progress charts, settings (free days, show_exercise_recap toggle), pause/delete/password controls. Current athlete cards in the Athletes tab are too dense and don't scale. ✅ **Done** — drawer is implemented in `components/admin/athlete-drawer.tsx`; progress charts (item 5) are still pending.

### 5. Performance test coloring
Color test results red/amber/green based on generic athletic population thresholds. Shown in admin athlete view and athlete progress page.

### 6. Program tab — "no program" state
Athlete program tab should show a clean "not assigned a program yet" state for athletes with no active program. Currently shows nothing or errors.

### 7. Excel athlete import
New importer matching the column map discussed:
- Columns A–AA per the spec (name, club→team, sport, position, birth year, FMS, performance tests, strength)
- Club matching: flag unknown clubs in a review step (map to existing / create new / leave individual)
- No invite emails sent — just creates DB records with Troy ID + temp password
- Birth year logic: 4 digits = year, 1–2 digits = age → calculate birth year

### 8. Program generation redesign (fallback/rules-based)
New program structure:
- Warmup → Mobility → Rubber bands → FMS correction (2 weeks only, then drop) → Strength/Power → Cooldown
- 3 days/week = Upper / Lower / Full split; other counts = normal flow
- Age < 12 = no strength exercises, replace with bodyweight + mobility
- Season awareness per sport (handball, football, basketball, volleyball, hockey — dates for Egypt)
- Off-season: add endurance; In-season: avoid high-intensity

### 9. AI program generation (Gemini)
- `GEMINI_API_KEY_1` for program generation, `GEMINI_API_KEY_2` for summarization
- System prompt includes: full athlete profile, assessment answers, Epley 1RMs, sport season, coach preferences (from `coach_system_prompts` table)
- Gemini derives goal from athlete data; outputs structured JSON with sections, exercises, sets, reps, tempo, load %, rationale paragraph, derived goal label, warnings checklist
- Gemini tries to find exercise image URLs; stored as-is with placeholder fallback
- Admin review UI: see full program, edit any exercise (name, sets, reps, tempo, load, order), confirm + save
- After edits: admin answers "why did you make this change?", Gemini 2 summarizes diff + answers → new system prompt stored in `coach_system_prompts`
- Fallback to rules-based generation if Gemini fails (network error, unparseable output, timeout); log failure to `system_log` table
- Program generation supports both flows from same UI — admin picks "AI" or "Rules-based"

### 10. Admin System tab
- New tab in admin showing: latest active system prompt (read-only + version history), `system_log` error/event feed (date, type, message, metadata)
- Manual system prompt override

### 11. Editable assessment form
- Admin can add/remove/reorder fields in `assessment_form_schema` table
- Field types: yes/no, 0–3 score, numeric range, text input
- New schema version created on each save; old records display with blanks for new fields

### 12. Exercise recap screen
- After all exercises done, before feedback form: full-screen list of exercises completed with sets, reps, loads, exercise image
- Viewable after session is done too — session card on dashboard shows "View recap" leading to this screen
- Controlled by `show_exercise_recap` toggle per athlete (admin sets it)
- Article links per exercise type (e.g. "Why mobility matters") in the exercise card during session

---

## 🔑 Environment variables needed (Vercel)

| Variable | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (admin operations) | ✅ Set |
| `GEMINI_API_KEY_1` | Program generation | ❌ Not yet |
| `GEMINI_API_KEY_2` | Summarization / prompt learning | ❌ Not yet |

---

## 📌 Known issues / things to watch

- **`session_exercise_selfies` table** — only works after the SQL above is run. If athletes upload selfies before the table exists, they get a silent error.
- **pg_cron for 7-day selfie cleanup** — the cleanup function exists but the cron schedule is commented out. Enable pg_cron in Supabase → Extensions, then uncomment the `cron.schedule` call in migration `202610070002`.
- **Troy ID login for existing athletes** — existing athletes created before this change have no `troy_id` and use real emails. They can still log in with email as before. Only new athletes get Troy IDs.
- **`sendAthleteInvitation` action** — still exists in `admin/actions.ts` but is no longer called anywhere. Can be deleted in a future cleanup.
- **Sign-up page** (`/auth/sign-up`) — still accessible. Should either be removed or restricted to admin-only since athlete creation now goes through the admin panel.
