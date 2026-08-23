"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function startSession(sessionPostId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: "Not authenticated" }

  const { data: existing } = await supabase
    .from("session_athletes")
    .select("id, attended_at")
    .eq("session_post_id", sessionPostId)
    .eq("athlete_id", userData.user.id)
    .maybeSingle()

  let sessionAthleteId = existing?.id

  if (!sessionAthleteId) {
    const { data: inserted, error } = await supabase
      .from("session_athletes")
      .insert({
        session_post_id: sessionPostId,
        athlete_id: userData.user.id,
        attended_at: new Date().toISOString(),
        status: "attended",
      })
      .select("id")
      .single()
    if (error) return { error: error.message }
    sessionAthleteId = inserted.id
  } else if (!existing?.attended_at) {
    await supabase
      .from("session_athletes")
      .update({ attended_at: new Date().toISOString(), status: "attended" })
      .eq("id", sessionAthleteId)
  }

  revalidatePath(`/session/${sessionPostId}`)
  return { sessionAthleteId }
}

export async function toggleExerciseCompletion(
  sessionAthleteId: string,
  sessionExerciseId: string,
  completed: boolean,
) {
  const supabase = await createClient()
  const { error } = await supabase.from("exercise_completions").upsert(
    {
      session_athlete_id: sessionAthleteId,
      session_exercise_id: sessionExerciseId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: "session_athlete_id,session_exercise_id" },
  )
  if (error) return { error: error.message }
  return { success: true }
}

export async function reportPain(
  sessionAthleteId: string,
  sessionExerciseId: string,
  input: { location: string; severity: number; notes: string },
) {
  const supabase = await createClient()
  const { error } = await supabase.from("exercise_completions").upsert(
    {
      session_athlete_id: sessionAthleteId,
      session_exercise_id: sessionExerciseId,
      pain_reported: true,
      pain_location: input.location,
      pain_severity: input.severity,
      pain_notes: input.notes,
    },
    { onConflict: "session_athlete_id,session_exercise_id" },
  )
  if (error) return { error: error.message }
  return { success: true }
}

export async function uploadSelfie(sessionAthleteId: string, imageUrl: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("session_selfies").insert({
    session_athlete_id: sessionAthleteId,
    image_url: imageUrl,
  })
  if (error) return { error: error.message }
  return { success: true }
}
