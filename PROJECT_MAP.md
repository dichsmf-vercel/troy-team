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
- **Bulk import (Excel)**: button opens a dialog showing the template (`IMPORT_COLUMNS`), download (.xlsx with sheets Athletes / Example / Instructions), choose file -> preview + per-row problems -> import in chunks of 15 -> credentials table + CSV download. Duplicates (same normalised name + birth year) are skipped; a failed row rolls its athlete back. Coach Ahmed's own sheet format (`كشف قياسات`) is also detected by the parser.
- **AI program**: `generateProgramWithAI` (no athlete name sent) -> `validateProgram` against the catalog -> coach edits -> `saveAIGeneratedProgram` (re-validated server side, saved as `pending_review`) -> `saveAdminEditsAndLearn` stores a PENDING prompt proposal -> admin approves in `PromptProposalsPanel`.
- **Models** (`lib/gemini.ts`): generation `gemini-3.8-flash` -> `3.6-flash` -> `3.1-flash-lite` (optional `GEMINI_MODEL` goes first); summaries `gemini-3.5-flash-lite` -> `3.1-flash-lite`. Re-check Google's model list before changing.
- **Selfies**: buckets `exercise-selfies`, `session-selfies`; server actions body limit raised to 10 MB in `next.config.mjs`.

## 5. Open items (priority order)
1. **Upgrade `next` to >=16.3.8 (critical RCE advisories)**, move `shadcn` to devDependencies, replace/patch `xlsx`. Re-run build + tests.
2. Run the 2 migrations, set `NEXT_PUBLIC_SITE_URL`, then deploy via PR + Vercel preview.
3. Dump the base schema + RLS to `supabase/schema.sql` (needs DB access; commands in `supabase/README.md`).
4. Scaling: `app/admin/page.tsx` uses `.in("athlete_id", ids)` with ALL athlete ids (URL length breaks around a few hundred athletes) and `listUsers(perPage:1000)`; page or batch these.
5. Public repo exposes coaching IP (`public/CoachAhmedRules.csv`, prompts, SQL): decide on making it private.
6. Arabic is implemented (see 3b); remaining: native proofread, RTL visual pass of admin/athlete screens, metadata/manifest, DB-stored English text.
7. Review RLS for `teams/programs/exercises` writes now that actions are role-guarded (defence in depth), and remove the legacy fallback in `deleteAthleteCompletely` once migration 202611180001 is live.
8. Still-dense single-line JSX in `session-panel`, `rules-panel`, `programs-panel`, `program-review-panel`: reformat when next touched.

## 6. Done well — leave alone
Auth core (`getUser()`, secure cookies, forced password change, Troy-ID generation), role guards + ownership checks, selfie upload hygiene, tolerant JSON extraction + catalog validation of AI output, human approval gates (program review, prompt proposals), security headers, no secrets in repo/history, strict TypeScript.

## 7. Env vars
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (public URL for invitation e-mails; falls back to `VERCEL_PROJECT_PRODUCTION_URL`, legacy `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`, never localhost in production), `GEMINI_API_KEY_1` (generation), `GEMINI_API_KEY_2` (prompt learning), `GEMINI_MODEL` (optional primary model). Dummy values are enough for `pnpm build` locally.

## 8. Working notes (save credits)
- Windows: run `pnpm` from PowerShell (Git Bash resolves the wrong shim).
- Verify with `pnpm typecheck && pnpm test && pnpm build` (CI does the same).
- New server action? Start it with a guard from `lib/auth/guards.ts`; add its file under `app/admin/actions/` by domain. "use server" must be the FIRST statement of the file (an import above it silently breaks the build).
- Large files: open only the part you need (`athlete-drawer.tsx`, `athlete-create-form.tsx`).
