import type { SupabaseClient } from "@supabase/supabase-js"

/** Ownership checks for athlete-side server actions (never trust ids sent from the browser). */

/** Returns the session post id when `sessionAthleteId` belongs to `userId`, otherwise null. */
export async function getOwnedSessionAthlete(
  supabase: SupabaseClient,
  userId: string,
  sessionAthleteId: string,
): Promise<{ sessionPostId: string } | null> {
  if (!sessionAthleteId) return null
  const { data } = await supabase
    .from("session_athletes")
    .select("session_post_id")
    .eq("id", sessionAthleteId)
    .eq("athlete_id", userId)
    .maybeSingle()
  return data ? { sessionPostId: data.session_post_id as string } : null
}

/** True when the exercise belongs to the session post (prevents mixing ids across sessions). */
export async function sessionHasExercise(supabase: SupabaseClient, sessionPostId: string, sessionExerciseId: string): Promise<boolean> {
  if (!sessionExerciseId) return false
  const { data } = await supabase
    .from("session_exercises")
    .select("id")
    .eq("id", sessionExerciseId)
    .eq("session_post_id", sessionPostId)
    .maybeSingle()
  return !!data
}

/** How many exercises of an assigned session are not completed yet (null when it could not be checked). */
export async function countMissingExercises(supabase: SupabaseClient, sessionPostId: string, sessionAthleteId: string): Promise<number | null> {
  const [exercises, completions] = await Promise.all([
    supabase.from("session_exercises").select("id").eq("session_post_id", sessionPostId),
    supabase.from("exercise_completions").select("session_exercise_id").eq("session_athlete_id", sessionAthleteId).eq("completed", true),
  ])
  if (exercises.error || completions.error) return null
  const done = new Set((completions.data ?? []).map((row) => row.session_exercise_id))
  return (exercises.data ?? []).filter((row) => !done.has(row.id)).length
}

/** True when the athlete program belongs to the user. */
export async function ownsProgram(supabase: SupabaseClient, userId: string, programId: string): Promise<boolean> {
  if (!programId) return false
  const { data } = await supabase.from("athlete_programs").select("id").eq("id", programId).eq("athlete_id", userId).maybeSingle()
  return !!data
}
