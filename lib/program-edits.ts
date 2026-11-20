import type { GeminiExercise, GeminiProgramOutput } from "@/lib/gemini-types"

/** Coach Ahmed's standing minimums for a session (5 exercises or a single strength exercise is too little). */
export const MIN_EXERCISES_PER_SESSION = 6
export const MIN_STRENGTH_PER_SESSION = 2

const isStrength = (exercise: GeminiExercise) => /strength|power/i.test(exercise.section)

/** Sessions that fall below the coach's minimums, as readable warnings (empty when all sessions are fine). */
export function sessionVolumeWarnings(program: Pick<GeminiProgramOutput, "sessions">): { date: string; total: number; strength: number }[] {
  return program.sessions
    .map((session) => ({ date: session.date, total: session.exercises.length, strength: session.exercises.filter(isStrength).length }))
    .filter((row) => row.total < MIN_EXERCISES_PER_SESSION || row.strength < MIN_STRENGTH_PER_SESSION)
}

const label = (exercise: GeminiExercise) => `${exercise.name_en} [${exercise.section}]`

/**
 * Plain-language list of what the coach changed between the AI's program and the saved one:
 * exercises added / removed / replaced / moved, section changes, sets/reps/load changes and the
 * resulting exercise counts per session. Fed to Gemini so it can propose a better coach prompt.
 */
export function describeProgramEdits(original: GeminiProgramOutput, edited: GeminiProgramOutput): string[] {
  const lines: string[] = []
  const sessions = Math.max(original.sessions.length, edited.sessions.length)
  for (let s = 0; s < sessions; s++) {
    const before = original.sessions[s]?.exercises ?? []
    const after = edited.sessions[s]?.exercises ?? []
    const date = edited.sessions[s]?.date ?? original.sessions[s]?.date ?? `session ${s + 1}`
    const changes: string[] = []
    const key = (exercise: GeminiExercise) => exercise.id ?? exercise.name_en
    const beforeKeys = before.map(key)
    const afterKeys = after.map(key)

    after.forEach((exercise, position) => {
      const was = beforeKeys.indexOf(key(exercise))
      if (was === -1) {
        const replaced = before[position] && !afterKeys.includes(key(before[position])) ? before[position] : null
        changes.push(replaced ? `replaced ${label(replaced)} with ${label(exercise)} at position ${position + 1}` : `added ${label(exercise)} at position ${position + 1}`)
        return
      }
      const old = before[was]
      if (was !== position) changes.push(`moved ${exercise.name_en} from position ${was + 1} to ${position + 1}`)
      if (old.section !== exercise.section) changes.push(`changed ${exercise.name_en} section from ${old.section} to ${exercise.section}`)
      const detail = [
        old.sets !== exercise.sets ? `sets ${old.sets}→${exercise.sets}` : "",
        old.reps !== exercise.reps ? `reps ${old.reps}→${exercise.reps}` : "",
        (old.load_percentage ?? null) !== (exercise.load_percentage ?? null) ? `load ${old.load_percentage ?? "none"}%→${exercise.load_percentage ?? "none"}%` : "",
      ].filter(Boolean)
      if (detail.length) changes.push(`${exercise.name_en}: ${detail.join(", ")}`)
    })
    before.forEach((exercise, position) => {
      if (afterKeys.includes(key(exercise))) return
      const replacedAt = after[position] && !beforeKeys.includes(key(after[position]))
      if (!replacedAt) changes.push(`removed ${label(exercise)} (was position ${position + 1})`)
    })
    if (!changes.length) continue
    const strength = (list: GeminiExercise[]) => list.filter(isStrength).length
    lines.push(`${date}: ${changes.join("; ")}. Exercises ${before.length}→${after.length}, strength/power ${strength(before)}→${strength(after)}.`)
  }
  return lines
}
