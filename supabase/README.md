# Supabase

## Migrations (`migrations/`)
Run **by hand** in the Supabase SQL editor, in file-name order, and **before** deploying code that depends on them.

| File | What it does | Needed by |
|---|---|---|
| `202610070001_program_exercise_selfies.sql` | per-exercise program selfies | athlete program sessions |
| `202610070002_session_exercise_selfies.sql` | per-exercise session selfies | assigned sessions |
| `202611180001_delete_athlete_cascade.sql` | one-transaction athlete deletion (`delete_athlete_cascade`) | `permanentlyDeleteAthlete` (falls back to the old multi-step delete if missing) |
| `202611180002_coach_prompt_approval.sql` | `status` column on `coach_system_prompts` so AI prompt proposals need admin approval | AI prompt learning (refuses to save proposals until it exists) |

The older tables (profiles, athletes, programs, RLS policies, …) were created in the Supabase dashboard and are
**not** in this repo yet. To capture them as the source of truth, run once (needs the Supabase CLI and the DB password):

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db dump --schema public -f supabase/schema.sql
supabase db dump --role-only -f supabase/roles.sql   # optional
```

Commit `schema.sql` and re-dump after every manual change in the dashboard. Review it for secrets before pushing to a public repo.

## Storage buckets used
`exercise-media` (public), `exercise-selfies`, `session-selfies`, `inbody-photos`.
