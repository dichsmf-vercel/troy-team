"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, requireStaff } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveCoachPrompt, proposeCoachPrompt, type CoachPrompt } from "@/lib/admin/coach-prompts"
import { validateProgram } from "@/lib/gemini-validate"
import type { CatalogExercise, GeminiProgramOutput } from "@/lib/gemini-types"

type Schedule = { athleteId: string; startDate: string; time: string; weekdays: number[] }

function validateSchedule(input: Schedule): string | null {
  if (!input?.athleteId || typeof input.athleteId !== "string") return "Choose an athlete."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate ?? "")) return "Choose a valid start date."
  if (!/^\d{2}:\d{2}$/.test(input.time ?? "")) return "Choose a valid session time."
  if (!Array.isArray(input.weekdays) || !input.weekdays.length || input.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return "Choose at least one training day."
  }
  return null
}

async function loadCatalog(): Promise<CatalogExercise[]> {
  const { data } = await createAdminClient().from("exercises").select("id,name_en,category,image_url").order("name_en")
  return (data ?? []) as CatalogExercise[]
}

function countExercises(program: GeminiProgramOutput): number {
  return program.sessions.reduce((total, session) => total + session.exercises.length, 0)
}

/** Re-validates a program coming back from the browser. Never trust the client copy. */
function checkProgramFromClient(program: GeminiProgramOutput, catalog: CatalogExercise[], schedule: Schedule) {
  const validated = validateProgram(program, catalog, { startDate: schedule.startDate, weekdays: schedule.weekdays })
  if (validated.error || !validated.program) return { program: null, error: validated.error ?? "Invalid program." }
  if (validated.program.sessions.length !== program.sessions.length || countExercises(validated.program) !== countExercises(program)) {
    return { program: null, error: "The program contains exercises or dates that are not valid. Reload and try again." }
  }
  return { program: validated.program, error: null }
}

// ─── AI generation ────────────────────────────────────────────────────────────

export async function generateProgramWithAI(input: Schedule) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error, data: null, rawText: "" }
  const invalid = validateSchedule(input)
  if (invalid) return { error: invalid, data: null, rawText: "" }

  const service = createAdminClient()

  // The athlete's name is deliberately NOT loaded: it is never sent to the AI.
  const [{ data: athlete }, { data: assessment }, exercises, activePrompt] = await Promise.all([
    service.from("athletes").select("height_cm,weight_kg,injury_notes,tier,sport,position,birth_year").eq("id", input.athleteId).single(),
    service
      .from("athlete_assessments")
      .select("id,athlete_assessment_answers(question_key,answer_json)")
      .eq("athlete_id", input.athleteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadCatalog(),
    getActiveCoachPrompt(service),
  ])
  if (!athlete) return { error: "Athlete not found.", data: null, rawText: "" }
  if (!exercises.length) return { error: "No exercises available in the catalog.", data: null, rawText: "" }

  const answers: Record<string, number | null> = {}
  for (const answer of (assessment?.athlete_assessment_answers ?? []) as { question_key: string; answer_json: { value?: number | null } | null }[]) {
    answers[answer.question_key] = answer.answer_json?.value ?? null
  }

  const { generateProgramWithGemini } = await import("@/lib/gemini")
  const result = await generateProgramWithGemini({
    athlete: {
      sport: athlete.sport ?? null,
      position: athlete.position ?? null,
      birth_year: athlete.birth_year ?? null,
      height_cm: athlete.height_cm ?? null,
      weight_kg: athlete.weight_kg ?? null,
      injury_notes: athlete.injury_notes ?? null,
      tier: athlete.tier ?? null,
    },
    assessmentAnswers: answers,
    exercises,
    startDate: input.startDate,
    time: input.time,
    weekdays: input.weekdays,
    coachSystemPrompt: activePrompt?.prompt_text ?? null,
  })

  if (result.error || !result.data) {
    await service
      .from("system_log")
      .insert({
        event_type: "ai_generation_failure",
        message: result.error ?? "Unknown error",
        metadata: { athleteId: input.athleteId, startDate: input.startDate },
      })
      .then(
        () => null,
        () => null,
      )
    return { error: result.error ?? "Generation failed", data: null, rawText: result.rawText }
  }
  return { error: null, data: result.data, rawText: result.rawText }
}

export async function saveAIGeneratedProgram(input: Schedule & { program: GeminiProgramOutput }) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error, id: null }
  const invalid = validateSchedule(input)
  if (invalid) return { error: invalid, id: null }

  const checked = checkProgramFromClient(input.program, await loadCatalog(), input)
  if (checked.error || !checked.program) return { error: checked.error, id: null }

  const start = new Date(`${input.startDate}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 27)

  const { data, error } = await createAdminClient()
    .from("athlete_programs")
    .insert({
      athlete_id: input.athleteId,
      month_start: input.startDate,
      month_end: end.toISOString().slice(0, 10),
      goal: checked.program.goal,
      generation_reason: {
        source: "gemini_ai",
        schedule: { time: input.time, weekdays: input.weekdays },
        sessions: checked.program.sessions,
        rationale: checked.program.rationale,
        warnings: checked.program.warnings,
      },
      status: "pending_review",
    })
    .select("id")
    .single()
  if (error || !data) return { error: error?.message ?? "Unable to save program.", id: null }

  revalidatePath("/admin")
  revalidatePath("/program")
  return { error: null, id: data.id as string }
}

/**
 * Saves a coach's edits to a generated program and asks the AI to PROPOSE a better system prompt.
 * The proposal is stored as `pending`; it changes nothing until an admin approves it.
 */
export async function saveAdminEditsAndLearn(input: {
  programId: string
  editedProgram: GeminiProgramOutput
  originalProgram: GeminiProgramOutput
  adminReason: string
}) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error, summary: null }
  const { user } = auth.ctx

  const service = createAdminClient()
  const { data: program } = await service
    .from("athlete_programs")
    .select("generation_reason, month_start")
    .eq("id", input.programId)
    .single()
  if (!program) return { error: "Program not found.", summary: null }

  const reason = (program.generation_reason ?? {}) as { schedule?: { weekdays?: number[] } } & Record<string, unknown>
  const schedule = { startDate: String(program.month_start), weekdays: reason.schedule?.weekdays ?? [] }
  const checked = checkProgramFromClient(input.editedProgram, await loadCatalog(), { athleteId: "-", time: "00:00", ...schedule })
  if (checked.error || !checked.program) return { error: checked.error, summary: null }

  const { error: updateError } = await service
    .from("athlete_programs")
    .update({
      generation_reason: { ...reason, sessions: checked.program.sessions, goal: checked.program.goal },
      goal: checked.program.goal,
    })
    .eq("id", input.programId)
  if (updateError) return { error: updateError.message, summary: null }
  revalidatePath("/admin")

  const activePrompt = await getActiveCoachPrompt(service)
  const { summarizeAdminEdits } = await import("@/lib/gemini")
  const learned = await summarizeAdminEdits({
    originalProgram: input.originalProgram,
    editedProgram: checked.program,
    adminReason: input.adminReason,
    currentPromptText: activePrompt?.prompt_text ?? "",
  })
  if (learned.error || !learned.newPromptText) return { error: learned.error ?? "No prompt proposal was produced.", summary: null }

  const proposal = await proposeCoachPrompt(service, { promptText: learned.newPromptText, summary: learned.summary ?? input.adminReason, userId: user.id })
  if (proposal.error) return { error: proposal.error, summary: learned.summary }

  return { error: null, summary: learned.summary }
}

// ─── Prompt proposals (admin approval) ────────────────────────────────────────

export type PromptProposal = Pick<CoachPrompt, "id" | "version" | "prompt_text" | "change_summary" | "created_at">

export async function getPendingPromptProposals(): Promise<{ error: string | null; proposals: PromptProposal[]; currentPrompt: string }> {
  const auth = await requireAdmin("Only admins can review prompt proposals.")
  if (!auth.ok) return { error: auth.error, proposals: [], currentPrompt: "" }

  const service = createAdminClient()
  const { data, error } = await service
    .from("coach_system_prompts")
    .select("id, version, prompt_text, change_summary, created_at")
    .eq("status", "pending")
    .order("version", { ascending: false })
  // Migration not applied yet → nothing to review.
  if (error) return { error: error.code === "42703" ? null : error.message, proposals: [], currentPrompt: "" }

  const active = await getActiveCoachPrompt(service)
  return { error: null, proposals: (data ?? []) as PromptProposal[], currentPrompt: active?.prompt_text ?? "" }
}

export async function reviewPromptProposal(id: string, decision: "approve" | "reject") {
  const auth = await requireAdmin("Only admins can review prompt proposals.")
  if (!auth.ok) return { error: auth.error }
  if (decision !== "approve" && decision !== "reject") return { error: "Invalid decision." }

  const { error } = await createAdminClient()
    .from("coach_system_prompts")
    .update({
      status: decision === "approve" ? "active" : "rejected",
      reviewed_by: auth.ctx.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { error: null }
}

// ─── Rules-based fallback ─────────────────────────────────────────────────────

export async function generateLegacyFallbackProgram(input: Schedule) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  const invalid = validateSchedule(input)
  if (invalid) return { error: invalid }

  const service = createAdminClient()
  const [{ data: exercises }, { data: athlete }] = await Promise.all([
    service.from("exercises").select("*"),
    service.from("athletes").select("birth_year,sport,injury_notes").eq("id", input.athleteId).maybeSingle(),
  ])
  if (!exercises?.length) return { error: "No exercises available in catalog." }

  const { generateFourWeekProgram } = await import("@/lib/program-engine")
  const sessions = generateFourWeekProgram({
    startDate: input.startDate,
    time: input.time,
    weekdays: input.weekdays,
    exercises,
    birthYear: athlete?.birth_year,
    sport: athlete?.sport,
  })

  const converted: GeminiProgramOutput = {
    goal: "Rules-based periodized training plan",
    rationale: `Rules-based program generated using Coach Ahmed's structured progression (${sessions[0]?.seasonPeriod ?? "Standard Periodization"}).`,
    warnings: athlete?.injury_notes ? [athlete.injury_notes] : [],
    sessions: sessions.map((session) => ({
      week: session.week,
      date: session.date,
      time: session.time,
      exercises: session.exercises.map((exercise) => ({
        id: exercise.id,
        name_en: exercise.name_en,
        section: exercise.section,
        sets: exercise.sets,
        reps: exercise.reps,
        load_percentage: exercise.loadPercentage,
        tempo: "2-0-2-0",
        notes: "Controlled tempo, steady breathing",
      })),
    })),
  }
  return { data: converted, error: null }
}
