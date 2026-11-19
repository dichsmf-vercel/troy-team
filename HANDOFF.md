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
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','supporting_coach')))
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

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('session-selfies', 'session-selfies', false)
on conflict (id) do nothing;
```

</details>

---

## ⚡ Current System Capabilities (Implemented & Verified)

### 1. Athletes Tab & Creation Engine
- **Athlete Creation Form (`athlete-create-form.tsx`)**:
  - Full preferences section: available training days selector (Sun–Sat), program assignment toggle (`has_program`: Monthly Program vs Assigned Exercises Only), and session exercise recap toggle (`show_exercise_recap`).
  - **Live RAG Color Indicators**: Real-time badge highlighting as numbers are typed for Vertical Jump, 30m Sprint, T-Test, Beep Test, Agility, Star Balance, and FMS Total (< 14 High Risk, 14–17 Moderate, ≥ 18 Optimal).
  - **FMS Arabic Scoring**: 0 (ضعيف جدا), 1 (ضعيف), 2 (جيد/متوسط), 3 (ممتاز).
  - **Epley 1RM Formula**: Automatically calculates 1RM from entered weight (kg) and reps performed (`1RM = Weight × (1 + Reps/30)`).
  - **Custom Field Editor**: Add custom key/value fields in any section (Account, Measurements, FMS, Performance, Strength, Preferences).
- **Athlete Drawer (`athlete-drawer.tsx`)**:
  - Mobile-responsive sliding sheet with clean collapsible panels.
  - Vitals & quick metrics grid with BMI and session stats.
  - Performance tests display with RAG color pills.
  - FMS score breakdown with Arabic ratings.
  - Settings manager: free days, program mode, exercise recap, sport, position.
  - Account security: 1-click temporary password generation with copy confirmation, pause/resume account, and permanent deletion.
  - Unread selfie review and deletion.
  - Session feedback & pain reports with severity levels.
- **Athlete Roster (`athletes-panel.tsx`)**:
  - Filter by Active, Paused, Pain Reports, or Unread Selfies.
  - Mobile-optimized cards with clear tags and Troy ID display.
- **Excel Roster Import (`excel-import.ts`)**:
  - Parses the Troy template and Coach Ahmed measurement-sheet layout in the browser, with an import preview and downloadable `.xlsx` template.
  - Matches athlete clubs to existing teams or creates missing teams, then creates Troy ID accounts and saves FMS/performance assessment values, including the Row Machine result when its column is labeled.
  - Shows generated temporary credentials once after import; incomplete FMS batteries do not receive a misleading total score.

### 2. Legacy / Fallback Program Engine (`lib/program-engine.ts`)
- **Proper Session Hierarchy**:
  1. Warm-up (2 exercises)
  2. Mobility (2 exercises, allowed to repeat across sessions for consistency)
  3. Rubber Bands (1–2 exercises for activation)
  4. FMS Problem Exercises (included in Weeks 1 & 2 ONLY, dropped in Weeks 3 & 4)
  5. Strength / Power / Main Work (adapted to age, split, and season)
  6. Cooldown (1 exercise)
- **3-Day Split Logic**: Upper Body Focus (Day 1), Lower Body Focus (Day 2), Full Body & Power (Day 3). Automatically falls back to balanced rotation if training days differ.
- **Age < 12 Youth Safety**: Automatically excludes heavy barbell lifts, deadlifts, and 1RM efforts; substitutes motor control, bodyweight, and agility drills.
- **Egyptian Sport Season Awareness**:
  - *Off-season* (May–July): Adds foundational endurance/conditioning blocks.
  - *Pre-season* (August): Power and high-intensity capacity preparation.
  - *In-season* (September–April): Match season; manages fatigue by reducing heavy strain to keep athletes fresh.
- **Percentages Only**: Session runner displays loads exclusively as percentages (e.g. `60%`, `70%`, `80%`), avoiding confusing raw kg values.

### 3. AI Program Generation & Fallback (Option B)
- **Gemini Engine (`lib/gemini.ts`)**: Resilient multi-model chain (3.1-flash-lite → 3.5-flash → 3.6 → 3.7 → 3.8 → flash-latest) with 5-stage JSON extraction.
- **Option B Fallback**: When Gemini API encounters high demand or errors, a prompt card appears: **"Generate with Rules Engine Instead"**. Clicking it immediately runs the rules engine and loads the structured 4-week program in the review panel without losing the coach's workflow.

### 4. Athlete-Side Adaptation
- **Empty State on `/program`**: Friendly illustrated empty state when no monthly program is assigned, directing athletes to their daily dashboard.
- **Exercise Recap Screen (`program-session-runner.tsx`)**:
  - When enabled (`show_exercise_recap = true`), finishing all exercises displays the full overview: *"This is all the exercises you did today"*, listing sets, reps, load percentages, and completion checks.
  - Athletes proceed from recap directly to the post-session feedback form.
  - Completed sessions provide a *"View Today's Exercise Recap"* button to review anytime.

---

## 🛠️ Verification & Build Status

Last verified 2026-11-18 (see PROJECT_MAP.md for how to re-run):
- [x] `pnpm typecheck` = 0 errors (type errors now fail the build; `ignoreBuildErrors` was removed)
- [x] `pnpm test` = unit tests pass (guards, redirects, Gemini validation, Excel import template round-trip, …)
- [x] `pnpm build` = passes. CI (`.github/workflows/ci.yml`) runs all three on every PR.
- [ ] Supabase migrations `202611180001` and `202611180002` must be run by hand BEFORE deploying this version (see `supabase/README.md`).

---

## 🔮 Future Work & Backlog

> The current task list lives in `PROJECT_MAP.md` §5 (owner/outside-access items) and §5b (full QA problem list with status). The items below are older product ideas.

### 0. DONE: Exercise videos and images
- Built-in library (`lib/exercise-library.ts`): all 101 catalogue exercises have a checked, embeddable YouTube demo and an Arabic name; 77 have start/end photos (public domain, `public/exercises/media`).
- Shown embedded in both session runners and as thumbnails on the athlete program page. A photo/video the coach sets in the Exercises tab overrides the built-in one.

### 1. Admin System & Settings Tab
- **System Management Workspace**: Add a dedicated "Settings" tab in `/admin` so Coach Ahmed never needs to touch the codebase.
- **Prompt Manager**: View active Gemini prompts, historical versions from `coach_system_prompts`, and manually adjust or rollback prompting instructions.
- **Theme Customizer**: Global theme toggle and branding options (light mode, dark mode, club color accent palettes) applied across all athlete and admin portals.

### 2. External Weight Sheet Integration
- Athletes maintain separate weight record sheets.
- Build an integration module that imports these historical lifting weights and pairs them with the session percentages (e.g. `70% of 120kg = 84kg`) for athletes who want exact kg guidance alongside percentage prescriptions.

### 3. Supabase Edge Functions for Alerting
- Implement a lightweight Supabase Edge Function triggered by `system_log` inserts for errors.
- Dispatches instant email notifications to Coach Ahmed or the tech lead when Gemini API quotas or demand spikes occur.

### 4. Arabic translation + font (DONE 2026-11-18, needs a native proofread)
- Whole UI now goes through `t("English text")` with Arabic in `lib/i18n/ar/part1-4.ts` (~800 strings); `tests/i18n.test.ts` keeps it complete. Arabic font is now **Cairo** (was IBM Plex Sans Arabic).
- Still English / to review: metadata + PWA manifest, raw database error messages, program/exercise names stored only in English (AI/engine JSON uses `name_en`), text stored in the database at creation time (e.g. "Standard Program"), and the intake action errors. Arabic wording should be proofread by Coach Ahmed; RTL layout needs a visual pass on every admin and athlete screen.
