import { tx } from "@/lib/i18n/translate"
export type ProgramExercise = {
  id: string
  name_en: string
  category?: string | null
  movement_pattern?: string | null
  section: string
  sets: number
  reps: string
  loadPercentage: number | null
  date: string
  time: string
}

export type GeneratedSession = {
  date: string
  time: string
  week: number
  focus?: string
  seasonPeriod?: string
  exercises: ProgramExercise[]
  tooFewExercises: boolean
}

/** Exercise-catalog row as the rules engine needs it. */
export type EngineExercise = {
  id: string
  name_en: string
  category?: string | null
  movement_pattern?: string | null
  [column: string]: unknown
}

export type ProgramInput = {
  startDate: string
  weekdays: number[]
  time: string
  exercises: EngineExercise[]
  weeks?: number
  birthYear?: number | null
  sport?: string | null
  fmsIssues?: string[]
}

const iso = (date: Date) => date.toISOString().slice(0, 10)

/**
 * Egyptian sports calendar season detection (primarily Handball & club sports)
 * May – July: Off-season (Foundational endurance & conditioning)
 * August: Pre-season (Power & high-intensity capacity preparation)
 * September – April: In-season (Competitive matches; avoid overtraining, load-managed)
 */
export function getEgyptianSeason(sport: string | null, date: Date): {
  period: "off-season" | "pre-season" | "in-season"
  label: string
  loadModifier: number
  addEndurance: boolean
} {
  const month = date.getMonth() // 0 = Jan, 4 = May, 6 = Jul, 7 = Aug, 8 = Sep

  if (month >= 4 && month <= 6) {
    return {
      period: "off-season",
      label: tx("Off-season (Endurance & Capacity Focus)"),
      loadModifier: 0.9,
      addEndurance: true,
    }
  }

  if (month === 7) {
    return {
      period: "pre-season",
      label: tx("Pre-season (Power & Speed Preparation)"),
      loadModifier: 1.0,
      addEndurance: false,
    }
  }

  return {
    period: "in-season",
    label: tx("In-season (Match Readiness & Freshness)"),
    loadModifier: 0.85,
    addEndurance: false,
  }
}

/**
 * Filters candidates matching category or pattern keywords
 */
function findMatching(
  pool: EngineExercise[],
  keywords: string[],
  excludeIds: Set<string> = new Set(),
  options: { names?: boolean } = {},
): EngineExercise[] {
  const lowerKeywords = keywords.map((k) => k.toLowerCase())
  return pool.filter((item) => {
    if (excludeIds.has(item.id)) return false
    const cat = String(item.category ?? "").toLowerCase()
    const pat = String(item.movement_pattern ?? "").toLowerCase()
    const name = options.names ? String(item.name_en ?? "").toLowerCase() : ""
    return lowerKeywords.some((kw) => cat.includes(kw) || pat.includes(kw) || (name ? name.includes(kw) : false))
  })
}

/** Exercises whose catalogue category is one of these (Coach Ahmed's categories: Lower Body, Upper Body, Core, Power, Agility, Conditioning, Mobility). */
function byCategory(pool: EngineExercise[], categories: string[]): EngineExercise[] {
  const wanted = categories.map((c) => c.toLowerCase())
  return pool.filter((item) => wanted.includes(String(item.category ?? "").trim().toLowerCase()))
}

/** First pool that has anything in it. */
function firstNonEmpty(...pools: EngineExercise[][]): EngineExercise[] {
  return pools.find((pool) => pool.length) ?? []
}

/** Up to `count` different exercises from `pool`, rotating with `offset`, never one already used in the session. */
function pickDistinct(pool: EngineExercise[], offset: number, count: number, used: Set<string>): EngineExercise[] {
  const picked: EngineExercise[] = []
  for (let step = 0; step < pool.length && picked.length < count; step++) {
    const exercise = pool[(offset + step) % pool.length]
    if (exercise && !used.has(exercise.id)) {
      used.add(exercise.id)
      picked.push(exercise)
    }
  }
  return picked
}

export function generateFourWeekProgram(input: ProgramInput): GeneratedSession[] {
  const weeks = input.weeks ?? 4
  const allCandidates = Array.isArray(input.exercises)
    ? input.exercises.filter((exercise) => exercise?.id && exercise?.name_en)
    : []

  const currentYear = new Date().getFullYear()
  const athleteAge = input.birthYear ? currentYear - input.birthYear : null
  const isYouth = athleteAge != null && athleteAge < 12

  // Youth athletes (< 12) must NOT perform heavy barbell/strength loading
  const candidates = isYouth
    ? allCandidates.filter((ex) => {
        const cat = String(ex.category ?? "").toLowerCase()
        const name = String(ex.name_en ?? "").toLowerCase()
        return (
          !cat.includes("heavy") &&
          !name.includes("barbell") &&
          !name.includes("deadlift") &&
          !name.includes("1rm")
        )
      })
    : allCandidates

  const sessions: GeneratedSession[] = []
  const start = new Date(`${input.startDate}T12:00:00`)
  const isThreeDaySplit = input.weekdays.length === 3

  let dayInCycle = 0

  for (let day = 0; day < weeks * 7; day++) {
    const date = new Date(start)
    date.setDate(start.getDate() + day)
    const weekday = date.getDay()
    if (!input.weekdays.includes(weekday)) continue

    const week = Math.floor(day / 7) + 1
    const season = getEgyptianSeason(input.sport ?? null, date)

    // Determine 3-day split focus or general balanced focus
    let splitFocus = tx("General Full Body")
    if (isThreeDaySplit) {
      const splitIdx = dayInCycle % 3
      if (splitIdx === 0) splitFocus = tx("Upper Body Focus")
      else if (splitIdx === 1) splitFocus = tx("Lower Body Focus")
      else splitFocus = tx("Full Body & Power Focus")
    }

    const picked: ProgramExercise[] = []
    const usedInSession = new Set<string>()

    // 1. WARM-UP (2 exercises)
    // Never fall back to the whole catalogue here (that put Ab Wheel Rollouts in the warm-up).
    const warmupPool = firstNonEmpty(
      findMatching(candidates, ["warm", "activation"]),
      byCategory(candidates, ["agility"]),
      byCategory(candidates, ["mobility"]),
    )
    for (const ex of pickDistinct(warmupPool, dayInCycle * 2, 2, usedInSession)) {
      {
        picked.push({
          id: ex.id,
          name_en: ex.name_en,
          category: ex.category,
          movement_pattern: ex.movement_pattern,
          section: tx("Warm-up"),
          sets: 2,
          reps: "8–10",
          loadPercentage: null,
          date: iso(date),
          time: input.time,
        })
      }
    }

    // 2. MOBILITY (2 exercises — mobility CAN repeat across sessions)
    const mobList = firstNonEmpty(byCategory(candidates, ["mobility"]), findMatching(candidates, ["mobility", "stretch", "flexibility"]))
    for (const ex of pickDistinct(mobList, dayInCycle, 2, usedInSession)) {
      {
        picked.push({
          id: ex.id,
          name_en: ex.name_en,
          category: ex.category,
          movement_pattern: ex.movement_pattern,
          section: tx("Mobility"),
          sets: 2,
          reps: "10 reps / 30s",
          loadPercentage: null,
          date: iso(date),
          time: input.time,
        })
      }
    }

    // 3. RUBBER BANDS (1-2 exercises)
    const bandPool = findMatching(candidates, ["rubber", "band", "elastic", "activation"])
    if (bandPool.length) {
      const ex = bandPool[dayInCycle % bandPool.length]
      if (ex && !usedInSession.has(ex.id)) {
        usedInSession.add(ex.id)
        picked.push({
          id: ex.id,
          name_en: ex.name_en,
          category: ex.category,
          movement_pattern: ex.movement_pattern,
          section: tx("Rubber Bands"),
          sets: 2,
          reps: "12–15",
          loadPercentage: null,
          date: iso(date),
          time: input.time,
        })
      }
    }

    // 4. FMS PROBLEM EXERCISES (Weeks 1 & 2 ONLY, omitted in Weeks 3 & 4)
    if (week <= 2) {
      const fmsPool = findMatching(candidates, ["fms", "corrective", "stability", "balance"])
      if (fmsPool.length) {
        const ex = fmsPool[dayInCycle % fmsPool.length]
        if (ex && !usedInSession.has(ex.id)) {
          usedInSession.add(ex.id)
          picked.push({
            id: ex.id,
            name_en: ex.name_en,
            category: ex.category,
            movement_pattern: ex.movement_pattern,
            section: tx("FMS Correction (W1–2)"),
            sets: 3,
            reps: "8–10",
            loadPercentage: null,
            date: iso(date),
            time: input.time,
          })
        }
      }
    }

    // 5. STRENGTH / POWER / MAIN (2-3 exercises)
    // Percentage progressions across 4 weeks: e.g. W1: 60%, W2: 70%, W3: 80%, W4: 70% (deload)
    const basePercentages = [60, 70, 80, 70]
    const rawPct = basePercentages[Math.min(week - 1, basePercentages.length - 1)]
    const loadPercentage = Math.round(rawPct * season.loadModifier)

    const loadBearing = firstNonEmpty(byCategory(candidates, ["lower body", "upper body", "power"]), candidates.filter(
      (c) => !c.category?.toLowerCase().includes("warm") && !c.category?.toLowerCase().includes("cool") && !c.category?.toLowerCase().includes("mobility"),
    ))
    let strengthPool = loadBearing
    if (isThreeDaySplit) {
      const splitIdx = dayInCycle % 3
      if (splitIdx === 0) strengthPool = firstNonEmpty(byCategory(candidates, ["upper body"]), loadBearing)
      else if (splitIdx === 1) strengthPool = firstNonEmpty(byCategory(candidates, ["lower body"]), loadBearing)
      else strengthPool = firstNonEmpty(byCategory(candidates, ["power", "lower body", "upper body"]), loadBearing)
    }

    for (const ex of pickDistinct(strengthPool, dayInCycle * 2, 2, usedInSession)) {
      {
        picked.push({
          id: ex.id,
          name_en: ex.name_en,
          category: ex.category,
          movement_pattern: ex.movement_pattern,
          section: isYouth ? tx("Motor Skills & Agility") : tx("Strength / Power"),
          sets: isYouth ? 3 : 3 + (week > 2 ? 1 : 0),
          reps: isYouth ? "10–12" : "6–8",
          loadPercentage: isYouth ? null : loadPercentage,
          date: iso(date),
          time: input.time,
        })
      }
    }

    // If Off-Season: Add endurance/conditioning block
    if (season.addEndurance) {
      const endurancePool = findMatching(candidates, ["conditioning", "endurance", "cardio", "circuit", "run"])
      const ex = pickDistinct(firstNonEmpty(byCategory(candidates, ["conditioning"]), endurancePool), dayInCycle, 1, usedInSession)[0]
      if (ex) {
        picked.push({
          id: ex.id,
          name_en: ex.name_en,
          category: ex.category,
          movement_pattern: ex.movement_pattern,
          section: tx("Off-Season Endurance"),
          sets: 3,
          reps: "45 sec / circuit",
          loadPercentage: null,
          date: iso(date),
          time: input.time,
        })
      }
    }

    // 6. COOLDOWN (1-2 exercises)
    const coolPool = firstNonEmpty(
      findMatching(candidates, ["cool", "stretch", "foam", "breathing"], new Set(), { names: true }),
      byCategory(candidates, ["mobility"]),
    )
    const coolEx = pickDistinct(coolPool, dayInCycle, 1, usedInSession)[0]
    if (coolEx) {
      picked.push({
        id: coolEx.id,
        name_en: coolEx.name_en,
        category: coolEx.category,
        movement_pattern: coolEx.movement_pattern,
        section: tx("Cooldown"),
        sets: 1,
        reps: "3–5 min",
        loadPercentage: null,
        date: iso(date),
        time: input.time,
      })
    }

    sessions.push({
      date: iso(date),
      time: input.time,
      week,
      focus: splitFocus,
      seasonPeriod: season.label,
      exercises: picked,
      tooFewExercises: picked.length < 5,
    })

    dayInCycle++
  }

  return sessions
}

export function monthLabel(date: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(`${date}T12:00:00`)
  )
}

export function weekdayLabel(day: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]
}
