"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function saveProgramExerciseFeedback(input: { programId: string; date: string; exerciseIndex: number; difficulty: number; painNotes: string; enjoyment: number }) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { error: "Not authenticated" }
  if (!Number.isInteger(input.difficulty) || input.difficulty < 0 || input.difficulty > 5) return { error: "Difficulty must be between 0 and 5." }
  const { error } = await supabase.from("program_session_feedback").upsert({ athlete_id: auth.user.id, athlete_program_id: input.programId, session_date: input.date, exercise_index: input.exerciseIndex, difficulty: input.difficulty, pain_notes: input.painNotes.trim() || null, enjoyment: input.enjoyment }, { onConflict: "athlete_id,athlete_program_id,session_date,exercise_index" })
  if (error) return { error: error.message }
  revalidatePath(`/program/session/${input.date}`)
  revalidatePath("/dashboard")
  return { error: null }
}
