"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth/guards"
import { getOwnedSessionAthlete, sessionHasExercise } from "@/lib/auth/ownership"
import type { TFunction } from "@/lib/i18n/translate"
import { getT } from "@/lib/i18n/get-language"

const MAX_NOTE_LENGTH = 1000
const MAX_SELFIE_BYTES = 8 * 1024 * 1024
const clean = (value: string | null | undefined, max = MAX_NOTE_LENGTH) => (value ?? "").trim().slice(0, max)
const isRating = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 5

export async function startSession(sessionPostId: string) {
  const t = await getT()
  const auth = await requireUser()
  if (!auth.ok) return { error: t("Not authenticated") }
  const { supabase, user } = auth.ctx

  const { data: post, error: postError } = await supabase.from("session_posts").select("id,athlete_id,team_id").eq("id", sessionPostId).maybeSingle()
  if (postError) return { error: t("Unable to load session: {message}", { message: postError.message }) }
  if (!post) return { error: t("Session not found.") }

  const { data: existing, error: existingError } = await supabase
    .from("session_athletes")
    .select("id, attended_at")
    .eq("session_post_id", sessionPostId)
    .eq("athlete_id", user.id)
    .maybeSingle()
  if (existingError) return { error: existingError.message }

  let sessionAthleteId = existing?.id as string | undefined

  if (!sessionAthleteId) {
    const { data: inserted, error } = await supabase
      .from("session_athletes")
      .insert({ session_post_id: sessionPostId, athlete_id: user.id, attended_at: new Date().toISOString(), status: "attended" })
      .select("id")
      .single()
    if (error) return { error: error.message }
    sessionAthleteId = inserted.id
  } else if (!existing?.attended_at) {
    await supabase.from("session_athletes").update({ attended_at: new Date().toISOString(), status: "attended" }).eq("id", sessionAthleteId)
  }

  revalidatePath(`/session/${sessionPostId}`)
  return { sessionAthleteId }
}

/** Validates ownership of the session and that the exercise is part of it. */
async function authorizeExercise(sessionAthleteId: string, sessionExerciseId: string, t: TFunction) {
  const auth = await requireUser()
  if (!auth.ok) return { error: t("Not authenticated") } as const
  const { supabase, user } = auth.ctx

  const owned = await getOwnedSessionAthlete(supabase, user.id, sessionAthleteId)
  if (!owned) return { error: t("Session not found.") } as const
  if (!(await sessionHasExercise(supabase, owned.sessionPostId, sessionExerciseId))) return { error: t("Exercise not found.") } as const
  return { supabase, user, sessionPostId: owned.sessionPostId } as const
}

export async function saveExerciseFeedback(
  sessionAthleteId: string,
  sessionExerciseId: string,
  input: { difficulty: number; painNotes: string; enjoyment: number },
) {
  const t = await getT()
  if (!isRating(input.difficulty) || !isRating(input.enjoyment)) return { error: t("Ratings must be between 0 and 5.") }
  const ctx = await authorizeExercise(sessionAthleteId, sessionExerciseId, t)
  if ("error" in ctx) return { error: ctx.error }

  const painNotes = clean(input.painNotes)
  const { error } = await ctx.supabase.from("exercise_completions").upsert(
    {
      session_athlete_id: sessionAthleteId,
      session_exercise_id: sessionExerciseId,
      difficulty: input.difficulty,
      enjoyment: input.enjoyment,
      pain_notes: painNotes || null,
      pain_reported: Boolean(painNotes),
    },
    { onConflict: "session_athlete_id,session_exercise_id" },
  )
  if (error) return { error: error.message }
  return { success: true }
}

export async function toggleExerciseCompletion(sessionAthleteId: string, sessionExerciseId: string, completed: boolean) {
  const t = await getT()
  const ctx = await authorizeExercise(sessionAthleteId, sessionExerciseId, t)
  if ("error" in ctx) return { error: ctx.error }

  const { error } = await ctx.supabase.from("exercise_completions").upsert(
    {
      session_athlete_id: sessionAthleteId,
      session_exercise_id: sessionExerciseId,
      completed: Boolean(completed),
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
  const t = await getT()
  if (!Number.isFinite(input.severity) || input.severity < 0 || input.severity > 10) return { error: t("Severity must be between 0 and 10.") }
  const ctx = await authorizeExercise(sessionAthleteId, sessionExerciseId, t)
  if ("error" in ctx) return { error: ctx.error }

  const { error } = await ctx.supabase.from("exercise_completions").upsert(
    {
      session_athlete_id: sessionAthleteId,
      session_exercise_id: sessionExerciseId,
      pain_reported: true,
      pain_location: clean(input.location, 120),
      pain_severity: input.severity,
      pain_notes: clean(input.notes),
    },
    { onConflict: "session_athlete_id,session_exercise_id" },
  )
  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Upload a selfie for one exercise of an assigned session ("session-selfies" bucket).
 * One selfie per (session_athlete_id, session_exercise_id) — upserted.
 */
export async function uploadExerciseSelfie(sessionAthleteId: string, sessionExerciseId: string, file: File) {
  const t = await getT()
  if (!file || file.size === 0) return { error: t("No file selected.") }
  if (file.size > MAX_SELFIE_BYTES) return { error: t("Image must be smaller than 8 MB.") }
  if (!file.type.startsWith("image/")) return { error: t("File must be an image.") }

  const ctx = await authorizeExercise(sessionAthleteId, sessionExerciseId, t)
  if ("error" in ctx) return { error: ctx.error }
  const { supabase, user } = ctx

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "jpg"
  const storagePath = `${user.id}/${sessionAthleteId}/${sessionExerciseId}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from("session-selfies").upload(storagePath, file, { contentType: file.type, upsert: false })
  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await supabase.from("session_exercise_selfies").upsert(
    {
      session_athlete_id: sessionAthleteId,
      session_exercise_id: sessionExerciseId,
      athlete_id: user.id,
      storage_path: storagePath,
      uploaded_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
    },
    { onConflict: "session_athlete_id,session_exercise_id" },
  )
  if (dbError) {
    await supabase.storage.from("session-selfies").remove([storagePath])
    return { error: dbError.message }
  }
  return { success: true }
}

export async function completeSession(sessionAthleteId: string) {
  const t = await getT()
  const auth = await requireUser()
  if (!auth.ok) return { error: t("Not authenticated") }

  const { error } = await auth.ctx.supabase
    .from("session_athletes")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionAthleteId)
    .eq("athlete_id", auth.ctx.user.id)
  if (error) return { error: error.message }
  return { success: true }
}
