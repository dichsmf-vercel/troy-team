/**
 * Typed access to the program JSON stored in `athlete_programs.generation_reason`.
 * Written by the AI generator, the rules engine and the manual generator, so every field is optional.
 */

export type StoredProgramExercise = {
  id?: string
  name?: string
  name_en?: string
  section?: string
  sets?: number | string | null
  reps?: number | string | null
  tempo?: string | null
  load_percentage?: number | null
  loadPercentage?: number | null
  notes?: string | null
  video_youtube_url?: string | null
  image_url?: string | null
}

export type StoredProgramSession = {
  date: string
  time?: string
  week?: number
  focus?: string
  seasonPeriod?: string
  tooFewExercises?: boolean
  exercises?: StoredProgramExercise[]
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function readProgramSessions(generationReason: unknown): StoredProgramSession[] {
  const sessions = asObject(generationReason)?.sessions
  if (!Array.isArray(sessions)) return []
  return sessions.filter((session): session is StoredProgramSession => !!asObject(session) && typeof (session as StoredProgramSession).date === "string")
}

/** Where the program came from ("gemini_ai", "coach_ahmed_rules_v1", …), if recorded. */
export function readProgramSource(generationReason: unknown): string | undefined {
  const source = asObject(generationReason)?.source
  return typeof source === "string" && source ? source : undefined
}
