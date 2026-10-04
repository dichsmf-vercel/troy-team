"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function startSession(sessionPostId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: "Not authenticated" }
  console.log("[v0] startSession server request", { sessionPostId, athleteId: userData.user.id })
  const { data: post, error: postError } = await supabase.from("session_posts").select("id,athlete_id,team_id").eq("id", sessionPostId).maybeSingle()
  const { count: exerciseCount, error: exerciseError } = await supabase.from("session_exercises").select("id", { count: "exact", head: true }).eq("session_post_id", sessionPostId)
  console.log("[v0] startSession server lookup", { sessionPostId, postFound: Boolean(post), postError: postError?.message, exerciseCount, exerciseError: exerciseError?.message })
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
    if (error) { console.error("[v0] startSession insert failed", { sessionPostId, athleteId: userData.user.id, error: error.message }); return { error: error.message } }
    sessionAthleteId = inserted.id
    console.log("[v0] startSession attendance created", { sessionPostId, sessionAthleteId })
  } else if (!existing?.attended_at) {
    await supabase
      .from("session_athletes")
      .update({ attended_at: new Date().toISOString(), status: "attended" })
      .eq("id", sessionAthleteId)
  }

  revalidatePath(`/session/${sessionPostId}`)
  return { sessionAthleteId }
}

export async function saveExerciseFeedback(sessionAthleteId: string, sessionExerciseId: string, input: { difficulty: number; painNotes: string; enjoyment: number }) { const supabase = await createClient(); if (input.difficulty < 0 || input.difficulty > 5 || input.enjoyment < 0 || input.enjoyment > 5) return { error: "Ratings must be between 0 and 5." }; const { error } = await supabase.from("exercise_completions").upsert({ session_athlete_id: sessionAthleteId, session_exercise_id: sessionExerciseId, difficulty: input.difficulty, enjoyment: input.enjoyment, pain_notes: input.painNotes.trim() || null, pain_reported: Boolean(input.painNotes.trim()) }, { onConflict: "session_athlete_id,session_exercise_id" }); if (error) return { error: error.message }; return { success: true } }

export async function toggleExerciseCompletion(
  sessionAthleteId: string,
  sessionExerciseId: string,
  completed: boolean,
) {
  const supabase = await createClient()
  if (completed) {
    const { data: selfie } = await supabase.from("session_selfies").select("id").eq("session_athlete_id", sessionAthleteId).maybeSingle()
    if (!selfie) return { error: "Upload a selfie before marking exercises complete." }
  }
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

export async function completeSession(sessionAthleteId: string, imageUrl: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: "Not authenticated" }
  const { error } = await supabase.from("session_selfies").upsert({ session_athlete_id: sessionAthleteId, image_url: imageUrl, uploaded_at: new Date().toISOString() }, { onConflict: "session_athlete_id" })
  if (error) return { error: error.message }
  const { error: attendanceError } = await supabase.from("session_athletes").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sessionAthleteId).eq("athlete_id", userData.user.id)
  if (attendanceError) return { error: attendanceError.message }
  revalidatePath(`/session/${sessionAthleteId}`)
  return { success: true }
}

export async function uploadSelfie(sessionAthleteId: string, imageUrl: string, justification?: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("session_selfies").upsert({
    session_athlete_id: sessionAthleteId,
    image_url: imageUrl,
    justification: justification?.trim() || null,
    uploaded_at: new Date().toISOString(),
  }, { onConflict: "session_athlete_id" })
  if (error) return { error: error.message }
  return { success: true }
}
