"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth/guards"
import { ownsProgram } from "@/lib/auth/ownership"

const MAX_SELFIE_BYTES = 5 * 1024 * 1024
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CONFLICT_KEY = "athlete_id,athlete_program_id,session_date"
const isRating = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5

async function authorizeProgram(programId: string, date: string) {
  const auth = await requireUser()
  if (!auth.ok) return { error: "Not authenticated" } as const
  if (!ISO_DATE.test(date)) return { error: "Invalid date." } as const
  if (!(await ownsProgram(auth.ctx.supabase, auth.ctx.user.id, programId))) return { error: "Program not found." } as const
  return { supabase: auth.ctx.supabase, user: auth.ctx.user } as const
}

export async function completeProgramSession(input: { programId: string; date: string; difficulty: number; painNotes: string; enjoyment: number }) {
  if (!isRating(input.difficulty) || !isRating(input.enjoyment)) return { error: "Ratings must be between 0 and 5." }
  const ctx = await authorizeProgram(input.programId, input.date)
  if ("error" in ctx) return { error: ctx.error }
  const { supabase, user } = ctx
  const now = new Date().toISOString()

  const { error } = await supabase.from("program_session_completions").upsert(
    {
      athlete_id: user.id,
      athlete_program_id: input.programId,
      session_date: input.date,
      status: "completed",
      attended_at: now,
      completed_at: now,
    },
    { onConflict: CONFLICT_KEY },
  )
  if (error) return { error: error.message }

  const { error: feedbackError } = await supabase.from("program_session_feedback").upsert(
    {
      athlete_id: user.id,
      athlete_program_id: input.programId,
      session_date: input.date,
      exercise_index: -1,
      difficulty: input.difficulty,
      pain_notes: input.painNotes.trim().slice(0, 1000) || null,
      enjoyment: input.enjoyment,
    },
    { onConflict: `${CONFLICT_KEY},exercise_index` },
  )
  if (feedbackError) return { error: feedbackError.message }

  revalidatePath("/dashboard")
  revalidatePath("/program")
  return { error: null }
}

export async function uploadProgramExerciseSelfie(input: { programId: string; date: string; exerciseIndex: number; file: File }) {
  if (!input.file || input.file.size === 0 || input.file.size > MAX_SELFIE_BYTES || !input.file.type.startsWith("image/")) {
    return { error: "Choose an image smaller than 5 MB." }
  }
  if (!Number.isInteger(input.exerciseIndex) || input.exerciseIndex < 0 || input.exerciseIndex > 200) return { error: "Invalid exercise." }

  const ctx = await authorizeProgram(input.programId, input.date)
  if ("error" in ctx) return { error: ctx.error }
  const { supabase, user } = ctx

  const ext = input.file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg"
  const path = `${user.id}/${input.programId}/${input.date}/${input.exerciseIndex}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from("exercise-selfies").upload(path, input.file, { contentType: input.file.type, upsert: false })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from("program_exercise_selfies").upsert(
    {
      athlete_id: user.id,
      athlete_program_id: input.programId,
      session_date: input.date,
      exercise_index: input.exerciseIndex,
      storage_path: path,
      uploaded_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
    },
    { onConflict: `${CONFLICT_KEY},exercise_index` },
  )
  if (error) {
    await supabase.storage.from("exercise-selfies").remove([path])
    return { error: error.message }
  }

  revalidatePath(`/program/session/${input.date}`)
  revalidatePath("/dashboard")
  return { error: null }
}

export async function saveProgramExerciseFeedback(input: {
  programId: string
  date: string
  exerciseIndex: number
  difficulty: number
  painNotes: string
  enjoyment: number
}) {
  if (!isRating(input.difficulty)) return { error: "Difficulty must be between 0 and 5." }
  if (!isRating(input.enjoyment)) return { error: "Enjoyment must be between 0 and 5." }
  const ctx = await authorizeProgram(input.programId, input.date)
  if ("error" in ctx) return { error: ctx.error }

  const { error } = await ctx.supabase.from("program_session_feedback").upsert(
    {
      athlete_id: ctx.user.id,
      athlete_program_id: input.programId,
      session_date: input.date,
      exercise_index: input.exerciseIndex,
      difficulty: input.difficulty,
      pain_notes: input.painNotes.trim().slice(0, 1000) || null,
      enjoyment: input.enjoyment,
    },
    { onConflict: `${CONFLICT_KEY},exercise_index` },
  )
  if (error) return { error: error.message }

  revalidatePath(`/program/session/${input.date}`)
  revalidatePath("/dashboard")
  return { error: null }
}
