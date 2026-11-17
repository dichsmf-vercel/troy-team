import type { CatalogExercise, GeminiExercise, GeminiProgramOutput, GeminiSession } from "@/lib/gemini-types"
import { englishT, type TFunction } from "@/lib/i18n/translate"

const english = englishT

/**
 * Validates and sanitises AI output against OUR exercise catalog.
 * The model is never trusted: unknown exercise ids are dropped (or rescued by exact
 * name match), numbers are clamped, dates must fall inside the program window.
 */

export const PROGRAM_SECTIONS = ["Warm-up", "Mobility", "Strength/Power", "Accessory", "Cooldown"] as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function cleanText(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalizeSection(value: unknown): string {
  const text = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s_]+/g, "") : ""
  const match = PROGRAM_SECTIONS.find((section) => section.toLowerCase().replace(/[\s_]+/g, "") === text)
  if (match) return match
  if (text.startsWith("warm")) return "Warm-up"
  if (text.startsWith("mobil")) return "Mobility"
  if (text.startsWith("strength") || text.startsWith("power")) return "Strength/Power"
  if (text.startsWith("cool")) return "Cooldown"
  return "Accessory"
}

function parseIsoDate(value: string): number | null {
  if (!ISO_DATE.test(value)) return null
  const ms = Date.parse(`${value}T12:00:00Z`)
  return Number.isNaN(ms) ? null : ms
}

export type ValidationOptions = {
  startDate: string
  weekdays: number[]
  /** Program length in days. Default: 28 (4 weeks). */
  windowDays?: number
  /** Translator for messages shown to coaches. Defaults to English. */
  t?: TFunction
}

export type ValidationResult = {
  program: GeminiProgramOutput | null
  warnings: string[]
  error: string | null
}

export function validateProgram(raw: unknown, catalog: CatalogExercise[], options: ValidationOptions): ValidationResult {
  const t = options.t ?? english
  const root = asRecord(raw)
  if (!root) return { program: null, warnings: [], error: t("The AI response was not a JSON object.") }
  if (!Array.isArray(root.sessions)) return { program: null, warnings: [], error: t("The AI response has no sessions array.") }

  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]))
  const byName = new Map(catalog.map((exercise) => [exercise.name_en.trim().toLowerCase(), exercise]))

  const startMs = parseIsoDate(options.startDate)
  const windowDays = options.windowDays ?? 28
  const warnings: string[] = []
  let droppedExercises = 0
  let rescuedByName = 0
  let droppedSessions = 0
  let offScheduleSessions = 0

  const sessions: GeminiSession[] = []

  for (const rawSession of root.sessions) {
    const session = asRecord(rawSession)
    if (!session) {
      droppedSessions++
      continue
    }

    const date = typeof session.date === "string" ? session.date.trim() : ""
    const dateMs = parseIsoDate(date)
    if (dateMs === null || (startMs !== null && (dateMs < startMs || dateMs > startMs + (windowDays - 1) * DAY_MS))) {
      droppedSessions++
      continue
    }
    if (options.weekdays.length && !options.weekdays.includes(new Date(dateMs).getUTCDay())) offScheduleSessions++

    const week = startMs !== null ? Math.floor((dateMs - startMs) / DAY_MS / 7) + 1 : clampInt(session.week, 1, 4, 1)
    const time = typeof session.time === "string" && /^\d{2}:\d{2}/.test(session.time.trim()) ? session.time.trim() : ""

    const exercises: GeminiExercise[] = []
    for (const rawExercise of Array.isArray(session.exercises) ? session.exercises : []) {
      const exercise = asRecord(rawExercise)
      if (!exercise) {
        droppedExercises++
        continue
      }

      const id = typeof exercise.id === "string" ? exercise.id.trim() : ""
      let match = byId.get(id)
      if (!match) {
        const name = typeof exercise.name_en === "string" ? exercise.name_en.trim().toLowerCase() : ""
        match = name ? byName.get(name) : undefined
        if (match) rescuedByName++
      }
      if (!match) {
        droppedExercises++
        continue
      }

      const load = exercise.load_percentage
      exercises.push({
        id: match.id,
        name_en: match.name_en,
        section: normalizeSection(exercise.section),
        sets: clampInt(exercise.sets, 1, 10, 3),
        reps: cleanText(typeof exercise.reps === "number" ? String(exercise.reps) : exercise.reps, 24) ?? "10",
        tempo: cleanText(exercise.tempo, 24),
        load_percentage: typeof load === "number" && Number.isFinite(load) ? Math.min(120, Math.max(0, load)) : null,
        notes: cleanText(exercise.notes, 240),
        image_url: match.image_url ?? null,
      })
    }

    if (!exercises.length) {
      droppedSessions++
      continue
    }
    sessions.push({ date, time, week: Math.min(Math.max(week, 1), Math.ceil(windowDays / 7)), exercises })
  }

  if (!sessions.length) {
    return {
      program: null,
      warnings,
      error: t("The AI program contained no valid sessions after checking it against the exercise catalog."),
    }
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date))

  if (droppedExercises) warnings.push(t("{count} exercise(s) suggested by the AI were not in your catalog and were removed.", { count: droppedExercises }))
  if (rescuedByName) warnings.push(t("{count} exercise(s) had a wrong id and were matched by name.", { count: rescuedByName }))
  if (droppedSessions) warnings.push(t("{count} session(s) were removed (invalid date, outside the 4-week window, or no valid exercises).", { count: droppedSessions }))
  if (offScheduleSessions) warnings.push(t("{count} session(s) fall on days that were not selected as training days.", { count: offScheduleSessions }))

  const aiWarnings = Array.isArray(root.warnings)
    ? root.warnings.map((warning) => cleanText(warning, 300)).filter((warning): warning is string => !!warning)
    : []

  return {
    program: {
      goal: cleanText(root.goal, 160) ?? "Training program",
      rationale: cleanText(root.rationale, 1200) ?? "",
      warnings: [...aiWarnings, ...warnings],
      sessions,
    },
    warnings,
    error: null,
  }
}

/** Basic sanity check for a model-proposed system prompt. */
export function validatePromptText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  if (text.length < 40 || text.length > 4000) return null
  return text
}
