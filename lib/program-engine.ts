export type ProgramExercise = { id: string; name_en: string; category?: string | null; movement_pattern?: string | null; section: string; sets: number; reps: string; loadPercentage: number | null; date: string; time: string; }
export type GeneratedSession = { date: string; time: string; week: number; exercises: ProgramExercise[]; tooFewExercises: boolean; }
export type ProgramInput = { startDate: string; weekdays: number[]; time: string; exercises: any[]; weeks?: number }

const sections = ["Warm-up", "Mobility", "Power", "Strength", "Accessory", "Conditioning", "Cooldown"] as const
const percentages = [60, 70, 80, 90, 100]
const iso = (date: Date) => date.toISOString().slice(0, 10)

export function generateFourWeekProgram(input: ProgramInput): GeneratedSession[] {
  const weeks = input.weeks ?? 4
  const candidates = Array.isArray(input.exercises) ? input.exercises.filter((exercise) => exercise?.id && exercise?.name_en) : []
  const sessions: GeneratedSession[] = []
  const start = new Date(`${input.startDate}T12:00:00`)
  let lastPatterns = new Set<string>()
  let sessionNumber = 0
  for (let day = 0; day < weeks * 7; day++) {
    const date = new Date(start)
    date.setDate(start.getDate() + day)
    const weekday = date.getDay()
    if (!input.weekdays.includes(weekday)) continue
    const week = Math.floor(day / 7) + 1
    const picked: ProgramExercise[] = []
    const usedSections = new Set<string>()
    const available = candidates.filter((exercise) => !lastPatterns.has(String(exercise.movement_pattern ?? exercise.category ?? "").toLowerCase()))
    const rotated = candidates.map((_, index) => candidates[(index + sessionNumber * 3) % candidates.length])
    const pool = available.length >= 7 ? available : rotated
    sections.forEach((section, index) => {
      const candidate = pool.find((exercise) => !usedSections.has(String(exercise.category ?? "").toLowerCase())) ?? pool[(index + sessionNumber) % Math.max(pool.length, 1)]
      if (!candidate) return
      const pattern = String(candidate.movement_pattern ?? candidate.category ?? "").toLowerCase()
      usedSections.add(String(candidate.category ?? "").toLowerCase())
      picked.push({ id: candidate.id, name_en: candidate.name_en, category: candidate.category, movement_pattern: candidate.movement_pattern, section, sets: section === "Warm-up" || section === "Cooldown" ? 1 : Number(candidate.default_sets) || week, reps: section === "Conditioning" ? "30 sec" : section === "Power" ? "5" : String(candidate.default_reps || "8–12"), loadPercentage: section === "Strength" ? percentages[Math.min(week, percentages.length - 1)] : null, date: iso(date), time: input.time })
    })
    lastPatterns = new Set(picked.map((item) => String(item.movement_pattern ?? item.category ?? "").toLowerCase()).filter(Boolean))
    sessions.push({ date: iso(date), time: input.time, week, exercises: picked, tooFewExercises: picked.length < 6 })
    sessionNumber += 1
  }
  return sessions
}

export function monthLabel(date: string) { return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`)) }
export function weekdayLabel(day: number) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day] }
export function getLoadPercentage(week: number) { return percentages[Math.min(Math.max(week - 1, 0), percentages.length - 1)] }

