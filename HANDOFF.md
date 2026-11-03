# Troy Team — Dev Handoff

Last updated: November 2026

---

## 🗄️ SQL to run in Supabase (if not already run)

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

## 🔑 Environment variables needed (Vercel)

| Variable | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (admin operations) | ✅ Set |
| `GEMINI_API_KEY_1` | Program generation (item 9) | ❌ Not yet |
| `GEMINI_API_KEY_2` | Summarization / prompt learning (item 9) | ❌ Not yet |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Email invite redirect (dev only) | ⚠️ Only needed for old `sendAthleteInvitation` flow, unused in prod |

---

## ✅ What's working (shipped to main)

### Auth & onboarding
- Login page accepts Troy ID (`TROY-XXXXXXX`) or real email
- Troy ID resolves to internal `@troy.internal` email before auth call
- Forced password change flow: middleware redirects to `/auth/set-password?forced=1` on every protected route if `password_change_required = true`
- Set-password page shows forced banner, validates length + match, clears flag, redirects to dashboard
- Intake wizard (4-step, auto-save, RTL support)
- Assessment form (basic free-text; structured schema planned in item 11)

### Athlete side
- Dashboard: today's assigned sessions, upcoming sessions, program session, attendance, paused-account banner
- Session runner (assigned): step-by-step, numbered nav pills, selfie enforced per exercise, pain dialog, done → summary
- Session summary form: RPE/soreness/sleep/rating sliders, symptoms, feedback text
- Program runner (program sessions): step-through with selfie upload and feedback
- Progress page: attendance rate, avg RPE, weight trend, measurement history, status card
- Profile page: athlete identity, language switch, settings

### Admin side
- Athletes tab: clean list view, per-athlete sheet drawer with stats / credentials / selfies / feedback / settings / controls
- Create athlete: Troy ID auto-generated, FMS Arabic dropdowns, Epley 1RM, sport/position/birth year, copy buttons for credentials
- Session creation and management: team or individual target, exercises with sets/reps/load, delete
- Program generator (rules-based): exercise pool filtered by rules, 4-week schedule, pending_review flow
- Program review panel: approve/reject programs
- Exercise management: add/edit video + image, YouTube embed
- Rules panel: CSV import + manual rule entry
- Selfie inbox: both program and session selfies, inline review + delete
- Feedback tab: session summaries + pain reports by athlete, red badge for pain count

---

## 🐛 Known bugs (must fix before prod)

### 1. Missing i18n dictionary keys → blank UI labels
**Files:** `components/progress/progress-dashboard.tsx`, `components/profile/profile-editor.tsx`, `components/session/session-runner.tsx`

These keys are used but don't exist in `lib/i18n/dictionaries.ts`:
| Used key | Correct key to add or use instead |
|---|---|
| `dict.common.profile` | Add `profile: "Profile"` to `common` |
| `dict.common.progress` | Add `progress: "Progress"` to `common` |
| `dict.common.saving` | Add `saving: "Saving..."` to `common` |
| `dict.common.saved` | Add `saved: "Saved"` to `common` |
| `dict.profile.fullName` | Use `dict.auth.fullName` (already exists) |
| `dict.progress.weight` | Add `weight: "Weight"` to `progress` |
| `dict.progress.rpeTitle` | Add `rpeTitle: "RPE history"` to `progress` |
| `dict.progress.attendance` | Use `dict.progress.attendanceRate` (already exists) |
| `dict.session.startSession` | Add `startSession: "Start session"` to `session` |

Since TS strict mode is off, these silently render as blank strings at runtime. Arabic translations needed for each.

### 2. `AthleteStats` "Assessed" counter always shows 0
**File:** `components/admin/athletes-panel.tsx` — `assessment_status === "complete"` but valid values are `"draft"`, `"submitted"`, `"in_review"`, `"approved"`. Fix: change to `=== "approved"`.

### 3. Sign-up page is publicly accessible
**File:** `app/auth/sign-up/page.tsx` — athletes can self-register bypassing the admin Troy ID flow. Either add `notFound()` to block it entirely, or restrict with a middleware rule. Also: the error message shown on password mismatch uses `dict.auth.weakPassword` ("Password must be at least 6 characters") — wrong message.

### 4. `permanentlyDeleteAthlete` leaves storage files
**File:** `app/admin/actions.ts` — deletes `session_selfies` rows but not `session_exercise_selfies` storage files (the new bucket). Athletes' exercise selfie images remain in the `session-selfies` bucket after account deletion.

### 5. `program-session-runner.tsx` dead code + no selfie enforcement
**File:** `components/session/program-session-runner.tsx`:
- `{false ? <CardFeedback /> : null}` — disabled feedback card block that never renders
- Selfie upload doesn't block exercise completion (assigned session runner enforces it; program runner doesn't)
- No pain reporting — only a single `painNotes` text field for the whole session

### 6. Admin athlete detail page (`/admin/athletes/[id]`) passes no `full_name`
**File:** `app/admin/athletes/[id]/page.tsx` — the save form calls `updateAthleteAccount` but doesn't pass `full_name` as a form field, so the action overwrites the athlete's name with an empty string on save. This page is partially superseded by the drawer but still reachable.

### 7. `importAthletesCsv` N+1 query
**File:** `app/admin/actions.ts` — calls `service.auth.admin.listUsers({perPage: 1000})` inside the per-row loop. Each imported row triggers a full user list fetch. Fix: fetch all users once before the loop.

### 8. Console debug logging in production
All these fire in the athlete and admin browser console on every load:
- `[session-debug]` — `components/session/session-runner.tsx` (multiple `console.groupCollapsed`, `console.log`, `console.error`, `console.warn`)
- `[assigned-session-debug]` — `app/(athlete)/dashboard/page.tsx`, `app/(athlete)/session/[sessionPostId]/page.tsx`
- `[athlete-debug]` — `components/admin/admin-board.tsx`
- `[assessment-debug]` — `components/assessment/assessment-form.tsx`
- `[program-debug]` — `components/admin/program-generator.tsx`
- `[v0]` — `lib/formatters.ts` (`logPageHealth`)
- `AssignedTrainingDiagnostics` component fires `console.error/warn/log` on every athlete dashboard load

### 9. Missing `error.tsx` and `loading.tsx`
No `error.tsx` boundary files exist under `app/` — a server component crash (e.g. DB error on `/dashboard`) shows Next.js's default error page instead of a user-friendly one. No `loading.tsx` skeleton states either.

### 10. `display_id` column likely missing
**Files:** `app/(athlete)/profile/page.tsx`, `app/admin/athletes/[id]/page.tsx` — both query `athletes.display_id` and `athletes.parent_link_code`. `display_id` was not in the HANDOFF SQL migrations. If missing, the query silently returns null and the athlete sees "—" for their ID.

### 11. Admin selfie signed URL N+1
**File:** `app/admin/page.tsx` — one `createSignedUrl` call per selfie in separate `Promise.all` loops. At scale (50+ selfies) this is slow. Fix: use `createSignedUrls` (plural, batched Supabase API).

---

## ⚠️ Things to watch / lower-priority issues

- **`sendAthleteInvitation` action** — still in `actions.ts`, no longer called anywhere. Safe to delete.
- **`/auth/sign-up`** — should be removed or restricted once Troy ID creation is fully rolled out
- **`app/admin/athletes/[id]/page.tsx`** — mostly superseded by the drawer. Consider redirecting to `/admin` or removing.
- **Middleware DB call on every request** — `proxy.ts` queries `profiles.password_change_required` on every protected page load for authenticated users. Fine at low scale; consider caching in session cookie at scale.
- **Admin page loads up to 1000 auth users** in one `listUsers` call. Works now, will need pagination as user base grows.
- **Program runner vs assigned session runner parity** — program runner has weaker selfie/pain UX than the assigned session runner.
- **`pg_cron` for 7-day selfie cleanup** — cleanup function exists but cron schedule is commented out. Enable pg_cron in Supabase → Extensions, then uncomment `cron.schedule` call.
- **Arabic in admin UI** — admin panel is 100% hardcoded English. The `lib/i18n/dictionaries.ts` has an `admin` section but none of the admin components use it.

---

## ✅ Full feature history (shipped to main)

### Assigned sessions — athlete side
- Full rewrite of `SessionRunner`: step-by-step UI, numbered nav pills, auto-advance on complete, prev/next buttons, inline errors
- Pre-start screen shows exercise count and selfie requirement
- Done screen routes to session summary

### Per-exercise selfie system
- One selfie required per exercise before marking complete (UI-enforced)
- Files stored in Supabase Storage (`session-selfies` bucket) — no more base64 in DB
- `uploadExerciseSelfie` server action with 8MB limit, file validation, storage upload, DB upsert with cleanup on failure
- Auto-cleanup SQL function (`cleanup_old_session_selfies`) deletes files + rows older than 7 days — needs pg_cron

### Admin selfie inbox
- `reviewSessionSelfie` action added
- Admin page fetches both `program_exercise_selfies` and `session_exercise_selfies`, generates signed URLs for both
- Inbox in Athletes tab shows both selfie types with correct review action per type

### Admin Feedback tab
- 6th tab in admin: "Feedback"
- Shows session summaries (RPE, overall rating, soreness, sleep, symptoms, written feedback) per athlete
- Shows pain reports per athlete (exercise name, location, severity/10, notes)
- Red badge on tab with unread pain report count
- Collapsible per-athlete cards with averages in header; search by athlete name

### Dashboard fixes
- Upcoming sessions count was rendering array object instead of `.length` — fixed
- `session_exercises` RLS was blocking `startSession` — removed the count check from the server action

### Troy ID login system
- `lib/troy-id.ts`: `generateTroyId()`, `troyIdToEmail()`, `isTroyId()` utilities
- Login page accepts Troy ID or email
- Forced password change flow in middleware + login + set-password page

### Athlete creation redesign
- No email field; FMS Arabic dropdowns (0–3); Epley 1RM live estimate; sport/position/birth year
- Troy ID + temp password shown post-creation with copy buttons

### Athlete tab redesign
- `athlete-drawer.tsx` — Sheet drawer: stats, credentials, selfies, feedback, settings, controls
- `athletes-panel.tsx` — clean list replacing the dense card grid
- `updateAthleteSettings` action for free_training_days / show_exercise_recap

---

## 📋 Remaining build order

Work through these in order — each unblocks the next.

### 5. Performance test coloring
Color test results red/amber/green based on generic athletic population thresholds.
Show in:
- Athlete drawer (in admin) next to each assessment answer
- Athlete progress page next to each metric

Threshold reference (generic athletic pop):
| Test | Red | Amber | Green |
|---|---|---|---|
| FMS total | < 14 | 14–17 | ≥ 18 |
| Sprint 30m (sec) | > 5.0 | 4.5–5.0 | < 4.5 |
| V-jump (cm) | < 30 | 30–45 | > 45 |
| T-test (sec) | > 11.5 | 10.5–11.5 | < 10.5 |
| Beep test VO₂ | < 40 | 40–50 | > 50 |

### 6. Program tab — "no program" state
Athlete `/program` page shows minimal empty div when no active program. Replace with a proper illustrated empty state: "Your coach hasn't assigned a program yet" with sport/team info and a "Check back soon" message.

### 7. Excel athlete import
New importer matching the column map:
- Columns: name (AR), name (EN), club→team, sport, position, birth year (4-digit or 1–2 digit age), FMS scores ×7, performance tests ×7, strength lifts ×5 (kg + reps → Epley 1RM)
- Club matching: flag unknown clubs in a review step (map to existing / create new / leave individual)
- No invite emails — creates DB records with Troy ID + temp password
- Birth year logic: 4 digits = year; 1–2 digits = age → calculate birth year from current year
- Shows a preview table before import; per-row error list on failure

### 8. Program generation redesign (rules-based fallback)
New session structure:
- Warmup → Mobility → Rubber bands → FMS correction (first 2 weeks only, then drop) → Strength/Power → Cooldown
- 3 days/week = Upper / Lower / Full-body split; other day counts = normal flow
- Age < 12 = no strength exercises → replace with bodyweight + mobility
- Season awareness per sport (handball, football, basketball, volleyball, hockey — Egyptian season calendar):
  - Off-season: add endurance block
  - In-season: avoid high-intensity, reduce load %

### 9. AI program generation (Gemini)
- `GEMINI_API_KEY_1` for program generation, `GEMINI_API_KEY_2` for summarization
- System prompt context: full athlete profile, assessment answers, Epley 1RMs, sport season, coach preferences (from `coach_system_prompts` table)
- Gemini output: structured JSON — sections, exercises, sets, reps, tempo, load %, rationale paragraph, derived goal label, warnings checklist
- Gemini tries to find exercise image URLs; stored as-is with placeholder fallback
- Admin review UI: see full program, edit any field (name, sets, reps, tempo, load, order), confirm + save
- After edits: admin answers "why did you make this change?", Gemini 2 summarizes diff → new system prompt stored in `coach_system_prompts`
- Fallback to rules-based if Gemini fails (network error, unparseable JSON, timeout); log to `system_log`
- Both flows available from same UI — admin picks "AI" or "Rules-based"

### 10. Admin System tab
- 7th tab in admin: "System"
- Shows: latest active system prompt (read-only + version history list), `system_log` error/event feed (date, type, message, metadata expandable)
- Manual system prompt override (replaces active prompt, creates new version)

### 11. Editable assessment form
- Admin can add/remove/reorder fields backed by `assessment_form_schema` table
- Field types: yes/no toggle, 0–3 score select, numeric range, free text
- New schema version on each save; athlete records with old schema show blanks for new fields gracefully

### 12. Exercise recap screen
- After all exercises done, before the feedback form: full-screen list of exercises with sets, reps, loads, exercise image
- Also viewable after session from the session card on dashboard ("View recap")
- Controlled per athlete by `show_exercise_recap` toggle (already in DB + settings drawer)
- Article/tip links per exercise type in the exercise card during session ("Why mobility matters" etc.)

---

## 📌 Prod-readiness checklist (before going live)

These are the things that MUST happen before showing this to athletes:

- [ ] Run the SQL block above in Supabase (adds columns + new tables)
- [ ] Fix the 9 missing i18n dictionary keys (blank labels in progress + profile pages)
- [ ] Fix `AthleteStats` "Assessed" counter (`=== "complete"` → `=== "approved"`)
- [ ] Strip or gate debug console logging (`[session-debug]`, `[athlete-debug]`, `AssignedTrainingDiagnostics`, etc.)
- [ ] Block or remove `/auth/sign-up` (athletes should only be created via admin panel)
- [ ] Fix `permanentlyDeleteAthlete` to also purge `session-selfies` storage bucket files
- [ ] Add `error.tsx` under `app/` (and ideally under `app/(athlete)/`) for graceful error pages
- [ ] Verify `display_id` column exists in `athletes` table or remove references
- [ ] Fix `importAthletesCsv` N+1 (fetch auth users list once, not per row)
- [ ] Fix `app/admin/athletes/[id]/page.tsx` save form (add hidden `full_name` field or redirect away)
- [ ] Enable pg_cron in Supabase and schedule the 7-day selfie cleanup

Nice-to-have before prod (not blocking):
- Batch signed URL generation in `admin/page.tsx` (`createSignedUrls` not one-by-one)
- Add `loading.tsx` skeleton states for athlete-side pages
- Remove dead `sendAthleteInvitation` action
- Arabic translations for the 9 missing keys
