"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function startSession(sessionPostId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: "Not authenticated" }

  const { data: post, error: postError } = await supabase
    .from("session_posts")
    .select("id,athlete_id,team_id")
    .eq("id", sessionPostId)
    .maybeSingle()
  if (postError) return { error: `Unable to load session: ${postError.message}` }
  if (!post) return { error: "Session not found." }

  const { count: exerciseCount, error: exerciseError } = await supabase
    .from("session_exercises")
    .select("id", { count: "exact", head: true })
    .eq("session_post_id", sessionPostId)
  if (exerciseError) return { error: `Unable to load session exercises: ${exerciseError.message}` }
  if (!exerciseCount) return { error: "This session has no exercises assigned yet." }

  const { data: existing, error: existingError } = await supabase
    .from("session_athletes")
    .select("id, attended_at")
    .eq("session_post_id", sessionPostId)
    .eq("athlete_id", userData.user.id)
    .maybeSingle()
  if (existingError) return { error: existingError.message }

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

export async function saveExerciseFeedback(
  sessionAthleteId: string,
  sessionExerciseId: string,
  input: { difficulty: number; painNotes: string; enjoyment: number },
) {
  const supabase = await createClient()
  if (input.difficulty < 0 || input.difficulty > 5 || input.enjoyment < 0 || input.enjoyment > 5)
    return { error: "Ratings must be between 0 and 5." }
  const { error } = await supabase.from("exercise_completions").upsert(
    {
      session_athlete_id: sessionAthleteId,
      session_exercise_id: sessionExerciseId,
      difficulty: input.difficulty,
      enjoyment: input.enjoyment,
      pain_notes: input.painNotes.trim() || null,
      pain_reported: Boolean(input.painNotes.trim()),
    },
    { onConflict: "session_athlete_id,session_exercise_id" },
  )
  if (error) return { error: error.message }
  return { success: true }
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

/**
 * Upload a selfie for a specific exercise in an assigned session.
 * Files are stored in Supabase Storage under the "session-selfies" bucket.
 * One selfie per (session_athlete_id, session_exercise_id) — upserted.
 */
export async function uploadExerciseSelfie(
  sessionAthleteId: string,
  sessionExerciseId: string,
  file: File,
) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: "Not authenticated" }

  if (!file || file.size === 0) return { error: "No file selected." }
  if (file.size > 8 * 1024 * 1024) return { error: "Image must be smaller than 8 MB." }
  if (!file.type.startsWith("image/")) return { error: "File must be an image." }

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg"
  const storagePath = `${userData.user.id}/${sessionAthleteId}/${sessionExerciseId}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("session-selfies")
    .upload(storagePath, file, { contentType: file.type, upsert: false })
  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await supabase.from("session_exercise_selfies").upsert(
    {
      session_athlete_id: sessionAthleteId,
      session_exercise_id: sessionExerciseId,
      athlete_id: userData.user.id,
      storage_path: storagePath,
      uploaded_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
    },
    { onConflict: "session_athlete_id,session_exercise_id" },
  )
  if (dbError) {
    // Clean up the uploaded file if the DB insert fails
    await supabase.storage.from("session-selfies").remove([storagePath])
    return { error: dbError.message }
  }

  return { success: true }
}

export async function completeSession(sessionAthleteId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: "Not authenticated" }
  const { error } = await supabase
    .from("session_athletes")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionAthleteId)
    .eq("athlete_id", userData.user.id)
  if (error) return { error: error.message }
  return { success: true }
}
