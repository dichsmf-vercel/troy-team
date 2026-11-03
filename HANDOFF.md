# Troy Team — Dev Handoff

Last updated: November 2026

---

## 🗄️ Supabase Migrations Status

✅ **All SQL migrations executed in Supabase by the team.**

<details>
<summary>Click to view executed SQL reference</summary>

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
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')));
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')));

-- session_exercise_selfies
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
</details>

---

## 🔑 Environment Variables (Vercel)

| Variable | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (admin operations) | ✅ Set |
| `GEMINI_API_KEY_1` | AI Program generation (Flash models) | ✅ Set |
| `GEMINI_API_KEY_2` | Summarization / prompt learning | ✅ Set |
| `GEMINI_MODEL` | Optional model override (defaults to 3.1-flash-lite with fallback) | ⚙️ Optional |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Email invite redirect (dev only) | ⚠️ Unused in prod |

---

## ✅ What's Working & Shipped to `main`

### 1. AI Program Generation Flow (Gemini)
- **Multi-Model Fallback Chain**: Starts with `gemini-3.1-flash-lite`, automatically cascading to `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash`, and `gemini-flash-latest`.
- **Automatic Error Resilience**: Automatically catches 404 (model deprecated for account), 503 (high demand spikes), and 429 (rate limits) and seamlessly retries the next candidate model without crashing.
- **Strict JSON Parsing**: Employs `responseMimeType: "application/json"` with a 5-step fallback extractor that strips Markdown code fences and cleans trailing commas.
- **Prompt Learning Engine**: When coaches edit an AI program and provide a coaching rationale, Gemini 2 analyzes the diff and persists updated coach preferences to `coach_system_prompts`.
- **Admin Review UI**: Clean workspace toggle in the Programs tab between Rules-based and ✨ AI Generator, complete with inline editing and approval workflows.
- **Client & Console Diagnostics**: Detailed `console.group` logs in browser DevTools showing raw output quality and full request payloads.

### 2. Auth & Identity
- **Troy ID System**: Athletes sign in via `TROY-XXXXXXX` or email; derives internal `@troy.internal` accounts.
- **Forced Password Reset**: Secure middleware forces first-time athletes to set a permanent password.
- **Sign-Up Locked**: Public `/auth/sign-up` returns `notFound()`, ensuring accounts are exclusively admin-issued.

### 3. Assigned Trainings & Runner
- **Sequential Exercise Runner**: Step-by-step runner with numbered nav pills, exercise demo videos, and auto-advance.
- **Per-Exercise Selfies**: Required upload before marking an exercise complete, stored in Supabase `session-selfies`.
- **In-Session Pain Reporting**: Modal pain dialog recording location, severity (1-10 slider), and coach notes.
- **Post-Session Summaries**: Captures RPE, muscle soreness, sleep quality, and qualitative feedback.

### 4. Admin Operations & Roster
- **Athletes Drawer**: Slide-out Sheet displaying stats, Troy ID credentials, selfie queues, feedback history, and controls.
- **Batched URL Generation**: Optimized with `createSignedUrls` to avoid N+1 bottlenecks when loading selfie galleries.
- **Session Assignment**: Assign sessions to whole teams or individual athletes with exercise load percentages.
- **Feedback Tab**: Unified dashboard for athlete session summaries and red-badged pain reports.

---

## 🛠️ Bugs Fixed & Prod Hardening Completed

- [x] **Missing i18n Keys**: Added `profile`, `progress`, `saving`, `saved`, `weight`, `rpeTitle`, `attendance`, `startSession`, `confirmPassword` in EN & AR.
- [x] **TypeScript Strict Typing**: Fixed dictionary typing with recursive `DeepString`, slider array types, and server action promise types. Zero errors on `npx tsc --noEmit`.
- [x] **Production Bundle**: Clean `next build` pass across all 22 static and dynamic routes.
- [x] **Admin Athlete Detail Preservation**: Fixed `/admin/athletes/[id]` form to preserve `full_name`.
- [x] **N+1 CSV Importer Query**: Batched auth user list retrieval before loop execution.
- [x] **Storage Purge on Deletion**: `permanentlyDeleteAthlete` sweeps files from `session-selfies` bucket.
- [x] **UI Error & Loading Boundaries**: Added `error.tsx` and `loading.tsx` across root and `(athlete)` routes.
- [x] **Action Hash Mismatch Handling**: Wrapped all client server action calls with recovery states and reload prompts.
- [x] **Gated Console Logs**: Cleaned up dev-only console output for production readiness.

---

## 📌 Prod-Readiness Checklist

- [x] Run SQL block in Supabase (tables, columns, policies, bucket) — **Done**
- [x] Fix missing i18n dictionary keys in EN & AR — **Done**
- [x] Fix `AthleteStats` "Assessed" counter (`=== "approved"`) — **Done**
- [x] Strip/gate debug console logging — **Done**
- [x] Block public `/auth/sign-up` — **Done**
- [x] Purge storage bucket files on athlete deletion — **Done**
- [x] Add graceful `error.tsx` and `loading.tsx` skeleton states — **Done**
- [x] Fix CSV import N+1 user listing query — **Done**
- [x] Fix athlete detail edit name erasure — **Done**
- [x] Batch signed URL generation in admin page — **Done**
- [x] Build and type verification passing (`tsc` & `next build`) — **Done**
- [ ] Enable `pg_cron` in Supabase extensions and schedule the 7-day selfie cleanup function (optional housekeeping).

---

## 🚀 Next Features & Roadmap

The remaining features from the product roadmap can be built in the following recommended order:

### 1. Performance Test RAG Coloring (Item 5)
Color test results red/amber/green based on generic athletic population thresholds:
- **FMS Total**: `< 14` (Red), `14–17` (Amber), `≥ 18` (Green)
- **30m Sprint**: `> 5.0s` (Red), `4.5–5.0s` (Amber), `< 4.5s` (Green)
- **Vertical Jump**: `< 30cm` (Red), `30–45cm` (Amber), `> 45cm` (Green)
- **T-Test**: `> 11.5s` (Red), `10.5–11.5s` (Amber), `< 10.5s` (Green)
- **Beep Test VO₂**: `< 40` (Red), `40–50` (Amber), `> 50` (Green)
- *Locations*: Show color-coded pill tags in the Admin Athlete Drawer and the Athlete Progress dashboard.

### 2. Program Page "No Program" Illustrated Empty State (Item 6)
- Replace the minimal empty container on `/program` with an athlete-friendly illustrated state:
  *"Your coach hasn't assigned a program yet — check back soon or message Coach Ahmed."*
- Display athlete sport, position, and team banner.

### 3. Excel Athlete Import with Club Matching (Item 7)
- Support `.xlsx` athlete roster imports with column mapping (AR/EN names, club, sport, position, age/birth year, FMS scores 1-7, 1RM strength lifts).
- Interactive club resolution step: match spreadsheet club names to existing teams, create new teams, or assign as unattached clients.
- Automatic Epley 1RM conversion from entered weight + reps.

### 4. Admin System Operations Tab (Item 10)
- Add a 7th tab to `/admin`: **"System"**.
- View current active system prompt and version history from `coach_system_prompts`.
- Manual prompt editor with rollback capabilities.
- Live event & error log viewer backed by `system_log`.

### 5. Dynamic Assessment Schema Builder (Item 11)
- Admin UI to customize athlete intake questions backed by `assessment_form_schema`.
- Supports toggles, 0–3 FMS selectors, numeric ranges, and free text.
- Versioned schema saves to prevent invalidating previous athlete records.

### 6. Exercise Recap Screen (Item 12)
- Post-session review screen showing exercises completed with prescribed sets, reps, and loads before the feedback form.
- Accessible on-demand from the dashboard ("View recap").
- Toggleable per athlete via `show_exercise_recap`.
