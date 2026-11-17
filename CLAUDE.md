# Troy Team

Next.js (App Router) + Supabase + Gemini app, deployed on Vercel. Package manager: **pnpm**.
**Read `PROJECT_MAP.md` first** (folder map, flows, known issues, what not to touch) before exploring the code; update it when structure or status changes.
Read `HANDOFF.md` for feature notes and Supabase migration status (partly outdated, see PROJECT_MAP section 7).

## Commands
- `pnpm install --frozen-lockfile` — install deps
- `pnpm dev` — local dev server (needs `.env.local`)
- `pnpm typecheck` — `tsc --noEmit` (must pass; type errors also fail the build)
- `pnpm test` — vitest unit tests (must pass)
- `pnpm build` — production build (must pass before opening a PR; dummy Supabase env vars are enough locally)

CI (`.github/workflows/ci.yml`) runs typecheck, test and build on every PR. There is no linter yet.

## Layout
See PROJECT_MAP.md section 3 for the full map. Key rules: server actions live in `app/admin/actions/<domain>.ts` and EVERY action starts with a guard from `lib/auth/guards.ts`; `"use server"` must be the first statement in the file.

## Translations (EN/AR)
- Every user-visible string must go through `t("English text")` (client: `useT()` / `useLanguage()`; server: `await getT()`). Use `{placeholders}` instead of string concatenation and `t.plural(n, "{count} athlete", "{count} athletes")` for counts.
- For module-level constants use `tx("English text")` and render with `t(label)`.
- Add the Arabic in `lib/i18n/ar/part*.ts`. `pnpm test` fails if any `t("…")` / `tx("…")` string has no Arabic or its placeholders differ. Bilingual DB fields: `useLn()(row.name_en, row.name_ar)`.

## Environment variables (never commit; `.env*.local` is gitignored)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`, `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_MODEL` (optional).
Production values live in the Vercel project settings.

## Workflow (Vercel + GitHub)
- `main` deploys to **Production** automatically. **Never push directly to `main`.**
- Work on a branch (`feat/...`, `fix/...`), push it, open a PR. Vercel builds a **Preview** deployment per PR — verify there before merging.
- Merging the PR into `main` is what ships to production. Do that only when the owner says so.
- Schema changes: add a file in `supabase/migrations/` and flag it clearly in the PR — it must be run in Supabase manually and BEFORE the code that needs it ships.
- Never run destructive Supabase/SQL commands or touch production data without explicit confirmation.

## GitHub account
This repo belongs to `dichsmf-vercel`. Git auth for this repo is routed through `gh` (repo-local credential helper). Check with `gh auth status` if a push is rejected.

## Conventions
- Match existing code style; keep changes small and focused.
- Commit messages: conventional style (`feat:`, `fix:`, `docs:`), as in the existing history.
