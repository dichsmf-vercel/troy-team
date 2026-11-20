# PROJECT_MAP — Troy Team

Living index of the codebase. **Read this first instead of exploring.** Update it when structure, risks, or status change.
Last updated: 2026-11-18 (hardening pass on top of `cde6e54`). Companion files: `CLAUDE.md` (rules/workflow), `HANDOFF.md` (feature notes + backlog), `supabase/README.md` (migrations, schema dump).

## 1. What it is
Training platform for athletes (Egyptian handball/football/etc.). Coaches (`admin`, `supporting_coach`) manage athletes, assessments, programs; athletes follow sessions and upload "selfies" as proof. AI (Gemini) drafts 4-week programs; a rules engine is the fallback. Bilingual EN/AR.
Stack: Next.js 16.3.0 (App Router, Turbopack), React 19, Supabase (auth/DB/storage), Tailwind v4, shadcn/base-ui, Gemini REST, Vercel hosting. pnpm.

## 2. Status snapshot
| Item | State |
|---|---|
| `pnpm typecheck` / `pnpm test` / `pnpm build` | all pass (50 unit tests). CI runs them on every PR (`.github/workflows/ci.yml`). Type errors now FAIL the build. |
| Production | Last 2 Vercel deploys of the OLD code failed (misplaced `"use server"`); fixed by the split of `app/admin/actions`. **Not deployed yet.** Live site = build of `c1b04ba` (2026-11-03). |
| Migrations to run BEFORE deploying | `202611180001_delete_athlete_cascade.sql`, `202611180002_coach_prompt_approval.sql` (code degrades safely if missing, see `supabase/README.md`). |
| Env var to ADD in Vercel | `NEXT_PUBLIC_SITE_URL` = production URL (invitation links). Also whitelist `<url>/auth/callback` in Supabase → Auth → URL configuration. |
| `any` / `console.log` | 0 `any`; no debug `console.log` (one dev-only logger in `lib/formatters.ts`). |
| Repo visibility | PUBLIC on GitHub (`dichsmf-vercel/troy-team`) |
| `pnpm audit --prod` | STILL OPEN: `next@16.3.0` has critical advisories (fixed in >=16.3.8), `xlsx@0.18.5` unpatched upstream, `shadcn` should be a devDependency (71 of 95 advisories). |

## 3. Folder map (where to look)
```
proxy.ts                 Next 16 "proxy" (was middleware.ts) -> lib/supabase/proxy.ts (session refresh, route guards, forced password change)
app/
  auth/        login (Troy ID or email), set-password, sign-up, callback/route.ts (open-redirect safe), error
  intake/      onboarding + actions.ts (athlete self-service)
  assessment/  form + actions.ts (assessment, photo, InBody)
  (athlete)/   dashboard, program (+ program/session/[date], actions.ts), progress, profile, session/[sessionPostId] (actions.ts, summary-actions.ts)
  admin/       page.tsx (loads everything with the service role; maxDuration 60), athletes/[id]/page.tsx
    actions/   SERVER ACTIONS by domain (every one starts with a guard):
               athletes.ts (create/update/pause/reset/invite/delete), imports.ts (Excel/CSV/rules import),
               teams-sessions.ts, exercises.ts, programs.ts (+rules, review), selfies.ts, ai.ts (Gemini, prompt proposals, rules fallback)
  parent/ legal/ actions/language.ts
components/
  admin/       athlete-drawer(807) athlete-create-form(752) ai-program-generator excel-athlete-import (template dialog + chunked import)
               prompt-proposals-panel (admin approves AI prompt changes) program-generator program-review-panel ...
  session/ intake/ assessment/ athlete/ auth/ dashboard/ parent/ providers/ shared/ ui/(shadcn)
lib/
  auth/        guards.ts (requireUser / requireStaff / requireAdmin), ownership.ts (athlete owns session/program)
  admin/       athlete-accounts.ts (create auth user, atomic delete), athlete-import-validation.ts, csv.ts, coach-prompts.ts, forms.ts, types.ts (admin row types)
  supabase/    server.ts client.ts admin.ts (service role) proxy.ts
  gemini.ts (client: models, header key, budget) · gemini-validate.ts (checks AI output vs catalog) · gemini-types.ts
  program-engine.ts (rules engine) · program-data.ts (typed program JSON) · excel-import.ts (parser + IMPORT_COLUMNS template)
  safe-redirect.ts · site-url.ts · client-errors.ts · troy-id.ts · rag-thresholds.ts · formatters.ts · types.ts · utils.ts · i18n/
supabase/      migrations/ (4 files) + README.md (run order, how to dump the base schema)
tests/         vitest unit tests (guards, redirect, site-url, gemini, excel-import, troy-id)
public/ data/  assets, CSVs, 2 empty xlsx assessment templates (unreferenced)
```

## 3b. Translations
`t("English")` everywhere (provider `useT/useLanguage/useLn`, server `getT`); Arabic in `lib/i18n/ar/part1-4.ts`; legacy nested dictionary `lib/i18n/dictionaries.ts` still used for the first screens. `tests/i18n.test.ts` fails on any missing Arabic string. Dates use `locale` from the language.

## 4. Key flows
- **Auth**: Supabase email/password; athletes log in with Troy ID -> `troy-<id>@troy.internal`. Proxy guards `/dashboard /intake /admin /profile /session /program /progress`; `/assessment` and `/parent` guard themselves. Roles in `profiles.role` (`athlete|admin|supporting_coach`).
- **Authorization rule**: server actions are public endpoints. Each starts with `requireAdmin()` / `requireStaff()` / `requireUser()`; athlete-side actions also check ownership (`lib/auth/ownership.ts`). Admin-only: create/edit/delete athletes, imports, rules, program review, deletes of teams/programs/exercises, prompt approval. Staff (admin + supporting_coach): teams create/edit, sessions, exercises create/edit/media, selfie review, AI generate/save, program templates.
- **Bulk import (Excel)** — layout = Coach Ahmed's measurement sheet (كشف قياسات: title row, header row, test sub-header row); columns are found by header text (`lib/excel-import.ts`); Arabic sports/positions/clubs/player names are mapped to English by `lib/import-dictionary.ts` (add words there). Not Ghaba-specific. Details: button opens a dialog showing the template (`IMPORT_COLUMNS`), download (.xlsx with sheets Athletes / Example / Instructions), choose file -> preview + per-row problems -> import in chunks of 15 -> credentials table + CSV download. Duplicates (same normalised name + birth year) are skipped; a failed row rolls its athlete back. Coach Ahmed's own sheet format (`كشف قياسات`) is also detected by the parser.
- **AI program**: `generateProgramWithAI` (no athlete name sent) -> `validateProgram` against the catalog -> coach edits -> `saveAIGeneratedProgram` (re-validated server side, saved as `pending_review`) -> `saveAdminEditsAndLearn` stores a PENDING prompt proposal -> admin approves in `PromptProposalsPanel`.
- **Models** (`lib/gemini.ts`): generation `gemini-3.8-flash` -> `3.6-flash` -> `3.1-flash-lite` (optional `GEMINI_MODEL` goes first); summaries `gemini-3.5-flash-lite` -> `3.1-flash-lite`. Re-check Google's model list before changing.
- **Selfies**: buckets `exercise-selfies`, `session-selfies`; server actions body limit raised to 10 MB in `next.config.mjs`.

## 5. Open items — need the owner or outside access (code work is done, see 5b)
1. **Merge/deploy** the pending work (PR + Vercel preview), then re-test on production: athlete flows, Parent View with a profile code, bulk import duplicate rule, rules tab resolving codes.
2. ~~CI workflow~~ — added in PR #18 (runs once merged).
3. **Schema + RLS dump** to `supabase/schema.sql` (needs DB access; commands in `supabase/README.md`). Then review RLS for `teams/programs/exercises` writes (defence in depth) and remove the legacy fallback in `deleteAthleteCompletely` (migration 202611180001 is live).
4. **Public repo** exposes coaching IP (`public/CoachAhmedRules.csv`, prompts): owner decides whether to make it private.
5. **Native Arabic proofread** (UI strings in `lib/i18n/ar/*`, exercise names in `lib/exercise-library.ts`), plus an RTL visual pass. DB data still English: team names without `name_ar`, old test sessions.
6. **Exercise media gaps**: 24 exercises have a video but no photo (list in 5b); Coach Ahmed can upload photos or swap any video in the Exercises tab (his media overrides the built-in ones). 101 of 102 `exercises.video_youtube_url` values were fake seeded links (`watch?v=` + 11 lowercase hex chars). On 2026-11-19 (owner approved) they were replaced in production with the checked library videos (matched by `exercise_code`); 0 fake links remain. The app still ignores any such link (`isPlaceholderVideo`) as a safety net.
7. Parent View hardening: done in code (every failed code takes ≥1.2 s; codes are 12 hex chars). Optional extra: a Vercel firewall rate-limit rule on `/parent` (dashboard setting).
8. **QA data cleanup before launch**: Claude QA Tester (TROY-YLHLLU6), QA Team (Claude), QA Exercise (Claude), QA Session (Claude), the QA program + its completion/selfie/feedback.
9. Low priority: dense single-line JSX in `session-panel`, `rules-panel`, `programs-panel`, `program-review-panel`, `parent-view`: reformat with Prettier (`--no-semi --print-width 130`) once it is added as a dev dependency. (Generators now default to the Cairo date.)

## 5b. Future work — full problem list (from QA 2026-11-18/19, details in `docs/qa/results-2026-11-18.md`)
Status: [ ] open · [~] in progress · [x] done

**Owner requests 2026-11-20 — status after shipping PR #19 + #20 (live 2026-11-20, migration 202611200001 run)**
- [x] **First-run walkthrough**: `components/shared/guided-tour.tsx`; auto-opens on a user's first 5 visits until finished/skipped, "?" in the top bar replays it. Tested on preview (all 9 admin steps). Not yet tested: athlete side, Arabic.
- [~] **Selfie required toggle** (athlete drawer): built + migration run. Not yet tested live: turn it on for the QA athlete, check both runners block completion until a selfie is uploaded, then view the selfie in the admin drawer; turn it off again.
- [~] **Show upcoming exercises toggle** (athlete drawer, default off = future sessions show date + count only): built, live. Not yet tested on the athlete Program tab.
- [~] **AI learns from coach edits**: editor add/remove/reorder/replace works live; generation now asks for one week + load_by_week and the app expands it to 4 weeks (34 s instead of timing out); 7+ exercises / 2+ strength rule works (12 sessions × 7). Saving edits creates a prompt proposal (tested live).
  - [ ] **BUG to fix first**: the proposal REPLACES the whole coach prompt and overfits to one athlete (test proposal said "goalkeeper explosiveness, always Bulgarian split squats"; it was rejected). Cause: `summarizeAdminEdits` gets an empty current prompt when the built-in default is in use, and is asked to rewrite the whole prompt. Fix: pass `DEFAULT_SYSTEM_PROMPT` when there is no active prompt; ask Gemini only for 1-3 GENERAL preference rules (not athlete- or session-specific) and append them to a "Coach preferences" list kept below the default prompt (`lib/gemini.ts`, `app/admin/actions/ai.ts`). Then test: edit → save → proposal shows only added rules → approve → generate again → check the rule is followed. Do not approve QA-derived proposals on production.
- [ ] **Re-import**: waiting on the owner — does this mean re-testing the existing import, or a new feature where re-importing an updated sheet UPDATES existing athletes (today they are skipped)?
- [ ] **Roster card (owner request)**: the purple "Selfies" filter chip / selfie badge is unreadable on the dark theme — use another color; remove the "Athlete Roster" card (title, CSV import) but keep the search (and filter chips) in a slim bar right above the athlete list.

**QA leftovers from 2026-11-20 testing (production)**: a pending AI program for Claude QA Tester (2026-11-20) awaiting review — reject or leave; four Gemini test images in `Desktop\Claude Images for Troy` (not used by the app).

**Athlete side**
- [x] Parent View: now a guarded-public server action (`app/parent/actions.ts`) that accepts the profile code. Was: the code on the profile (`athletes.parent_link_code`) is rejected; `redeem_parent_link` (dashboard-only SQL) reads `parent_links`, which nothing creates.
- [x] Profile shows the Troy ID, hides internal e-mails, one parent code with "Create code". Was: profile showed the internal e-mail `troy-…@troy.internal` and a legacy "Athlete ID" (`display_id`) instead of the Troy ID; contradictory parent-code texts.
- [x] Progress (and parent view) use `lib/athlete-activity.ts`: assigned + program sessions; program difficulty 0–5 shown ×2 on the 0–10 RPE scale. Was: progress ignored program sessions (attendance 0/0, RPE "—" after completing one); RPE shown "/10" but asked 0–5.
- [x] Future program sessions are locked (page + server action). Was: future program sessions could be opened and completed early (recorded as attended).
- [x] Program page lists all sessions (upcoming = preview, missed = "Catch up"), grouped by real section with photo thumbnails. Was: program page listed only past sessions; no preview of upcoming ones.
- [x] Dashboard keeps unfinished coach sessions from the last 14 days, counts program sessions, shows the next session on rest days. Was: missed coach-assigned sessions disappeared from the dashboard.
- [x] Feedback screen says "All exercises completed" even when some were skipped; sliders have no accessible labels.
- [x] Athlete pages use `lib/dates.ts` (Africa/Cairo). Admin generators still use UTC. Was: "today" computed in UTC on the server (wrong date 00:00–02:00 Cairo).
- [x] Calendar weekday misalignment; "1 sets"; intake duplicate measurements; intake overwriting "assigned only" mode; set-password Save never submitted.

**Admin side**
- [x] Duplicate rule is now name + birth year, or name + club when a birth year is missing (`app/admin/actions/imports.ts`). Was: bulk import duplicate check was name-only: a real player sharing a common name is skipped (row 5 "Mohamed Ahmed"). Use name + birth year (+ club), or let the coach choose.
- [x] Joined names are split on known names (`splitJoinedNames`). Was: Arabic names without spaces (e.g. "لارااسامه") are not transliterated.
- [x] Missing `exercise_code` is filled from the CSV mapping by name when the admin page loads (`exerciseCodeForName`), so rules resolve and the rules engine applies ADD/REMOVE. Was: rules tab: all 130 rules "Unresolved" because catalog exercises have no `exercise_code`; `public/exercises/Coach_Ahmed_Exercises.csv` has the E001–E101 → name mapping.
- [x] Generators start with the athlete's free days (`defaultTrainingDays`); AI sessions on other days are moved to the nearest chosen day (`lib/gemini-validate.ts`). Was: generators started with Mon/Wed/Fri instead of the athlete's available days; AI then schedules days the coach did not pick.
- [x] Staff accounts are filtered out of the athlete list (`app/admin/page.tsx`). Was: "Coach Ahmed" (admin) appeared as an athlete in roster, generators and pickers.
- [x] "Assessed" counts athletes with recorded test results or a submitted/approved assessment. Was: "Assessed 0" after FMS + tests are entered at creation (assessment stays `draft`).
- [x] Engine picks by catalogue category, never repeats an exercise in a session, warms up with agility/mobility (`tests/program-engine.test.ts`). Was: rules-engine program quality: squat on an "upper body" day, same exercise as power and strength, Ab Wheel as warm-up, same exercise in warm-up and cooldown.
- [x] Searchable, sorted `AthletePicker` (name in both languages + Troy ID) in both generators; session picker sorted and localized; "Not Set" hidden and no longer stored on import. Was: athlete pickers unsorted, no search (87+ athletes); roster shows "NOT SET (Not Set)".
- [x] Drawer "Settings saved" message far from the button.
- [x] Import dialog: "Save the login details" shown even when 0 were imported.

**Exercise catalog / media**
- [x] Exercise media: `lib/exercise-library.ts` maps all 101 catalogue exercises (E001–E101) to a checked, embeddable YouTube demo; 77 have start/end photos in `public/exercises/media` (free-exercise-db, public domain). `resolveExerciseMedia` prefers the coach's own `image_url`/`video_youtube_url`. Shown in both runners (`components/session/exercise-media.tsx`, youtube-nocookie embed) and as thumbnails on the program page. Missing photos (24): landmine presses, suitcase carry, bird dog, trap bar jumps, skater jumps/squats, Copenhagen plank, TRX squat, cossack squat, wall ball, dumbbell snatch, pogo/single-leg broad jumps, agility ladder, 5-10-5, downhill runs, swimming, SkiErg, wall slides, 90/90, Brettzel, tempo runs, assault bike → coach uploads.
- [x] Arabic names for all 101 exercises in `lib/exercise-library.ts` (`exerciseDisplayName`; used by athlete runners/program page and admin lists via `name_ar`). Categories still English in the DB.

**Arabic (code, not data)**
- [x] Session team picker shows `name_en` (use `useLn`); program generator picker shows English names and raw sport ("handball", "Not Set").
- [x] Feedback tab "1 session", "RPE 5"; roster "Not Set"; hard-coded "Close" in `components/ui/dialog.tsx` footer.

**Platform**
- [x] `next` 16.3.8 (RCE advisories), `xlsx` 0.20.3 from the SheetJS CDN (npm's 0.18.5 has known CVEs), `shadcn` moved to devDependencies.
- [x] Admin page queries chunked (`lib/supabase/batch.ts`), auth users paged: no URL-length failure at a few hundred athletes.
- [x] Coach now sees monthly-program session feedback and pain notes in the Feedback tab (were never shown).
- [ ] Schema/RLS dump, CI workflow push, repo privacy: see section 5.

**AI program test on production (2026-11-19, QA athlete)**: generate → save → approve → athlete session with photos/videos all work.
- [x] Gemini put a session on an unchosen day (Sat) while all chosen days within ±3 were taken; the validator now searches the whole window (PR #19).
- [x] Athlete picker: a search that no longer matches the selected athlete selects the first match.
- [x] Approving a program archives the athlete's other approved/active programs.
- [x] `/program/session/<date>` on a rest day (or with no program) shows a card instead of a 404.

**Modest exercise media (2026-11-19, owner request: men only, not shirtless, nothing above the knee)**
- Reviewed every library photo and video by sampled frames (start, 25/50/75%). Photos kept only where they comply: E004 E005 E021 E025 E031 E035 E038 E056 E067 E077 E080 E091 E093; all other stock photos were deleted.
- 48 videos replaced with compliant demos (library + production `exercises.video_youtube_url`, updated by code); ~16 current videos already complied and were kept.
- [x] E005 E021 E035 E067 E077 are photo-only now (compliant photos kept, video removed in the library and in production).
- [x] Every exercise now has start/end images: the 13 compliant photo sets, plus generated illustrations (man in long-sleeved shirt and long trousers) for the other 88 in `public/exercises/illustrations` (source: `scripts/exercise-illustrations/`, `node scripts/exercise-illustrations/build.mjs` rebuilds them; poses in `poses.mjs`).
- [x] The 32 videos below were hidden (library + production) and show illustrations only. A real compliant photo or video from Coach Ahmed in the Exercises tab overrides the illustration.
- Hidden-video exercises, were: E001 E002 E006 E007 E009 E014 E016 E019 E026 E037 E040 E042 E043 E044 E048 E049 E051 E052 E055 E063 E065 E066 E079 E082 E084 E085 E086 E087 E092 E095 E096 E101. No usable open photo source: free-exercise-db models wear shorts, wger images are shirtless anatomy drawings. Best fix: Coach Ahmed photographs these (start + end position) and uploads them in the Exercises tab, which overrides the built-in media. E095 Swimming cannot meet the rule with standard swimwear.
- Frame sampling can miss a few seconds of a video; a full watch-through is still advisable.

## 6. Done well — leave alone
Auth core (`getUser()`, secure cookies, forced password change, Troy-ID generation), role guards + ownership checks, selfie upload hygiene, tolerant JSON extraction + catalog validation of AI output, human approval gates (program review, prompt proposals), security headers, no secrets in repo/history, strict TypeScript.

## 7. Env vars
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (public URL for invitation e-mails; falls back to `VERCEL_PROJECT_PRODUCTION_URL`, legacy `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`, never localhost in production), `GEMINI_API_KEY_1` (generation), `GEMINI_API_KEY_2` (prompt learning), `GEMINI_MODEL` (optional primary model). Dummy values are enough for `pnpm build` locally.

## 8. Working notes (save credits)
- Windows: run `pnpm` from PowerShell (Git Bash resolves the wrong shim).
- Verify with `pnpm typecheck && pnpm test && pnpm build` (CI does the same).
- New server action? Start it with a guard from `lib/auth/guards.ts`; add its file under `app/admin/actions/` by domain. "use server" must be the FIRST statement of the file (an import above it silently breaks the build).
- Large files: open only the part you need (`athlete-drawer.tsx`, `athlete-create-form.tsx`).
