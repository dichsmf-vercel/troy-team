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

/** True when the athlete program belongs to the user. */
export async function ownsProgram(supabase: SupabaseClient, userId: string, programId: string): Promise<boolean> {
  if (!programId) return false
  const { data } = await supabase.from("athlete_programs").select("id").eq("id", programId).eq("athlete_id", userId).maybeSingle()
  return !!data
}
