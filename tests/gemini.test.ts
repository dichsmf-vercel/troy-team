import { describe, expect, it } from "vitest"
import { buildGenerationPrompt, extractJson, GENERATION_MODELS, resolveModels, SUMMARY_MODELS } from "@/lib/gemini"
import { expandWeekTemplate, validateProgram, validatePromptText } from "@/lib/gemini-validate"

const catalog = [
  { id: "ex-squat", name_en: "Back Squat", category: "strength", image_url: "/squat.png" },
  { id: "ex-plank", name_en: "Plank", category: "core", image_url: null },
]

const baseOptions = { startDate: "2026-12-01", weekdays: [2, 4] } // Tue, Thu

const session = (date: string, exercises: unknown[]) => ({ date, time: "18:00", week: 1, exercises })

describe("extractJson", () => {
  it("parses plain, fenced and trailing-comma JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('noise {"a":[1,2,],} noise')).toEqual({ a: [1, 2] })
  })
  it("throws on garbage", () => {
    expect(() => extractJson("not json")).toThrow()
    expect(() => extractJson("")).toThrow()
  })
})

describe("model selection", () => {
  it("never tries more than 3 models and uses only the documented stable names", () => {
    const chain = resolveModels("generation", "my-custom-model")
    expect(chain).toHaveLength(3)
    expect(chain[0]).toBe("my-custom-model")
    expect(resolveModels("generation", undefined)).toEqual([...GENERATION_MODELS])
    expect(resolveModels("summary", "ignored")).toEqual([...SUMMARY_MODELS])
    // The old list contained guessed names that do not exist.
    expect([...GENERATION_MODELS, ...SUMMARY_MODELS]).not.toContain("gemini-3.7-flash")
  })
  it("de-duplicates an override that is already in the chain", () => {
    expect(resolveModels("generation", GENERATION_MODELS[0])).toEqual([...GENERATION_MODELS])
  })
})

describe("generation prompt privacy", () => {
  it("contains no athlete name field", () => {
    const prompt = buildGenerationPrompt({
      athlete: { sport: "handball", position: "GK", birth_year: 2010, height_cm: 180, weight_kg: 70, injury_notes: null, tier: null },
      assessmentAnswers: {},
      exercises: catalog,
      startDate: "2026-12-01",
      time: "18:00",
      weekdays: [2, 4],
    })
    expect(prompt).not.toMatch(/^Name:/m)
    expect(prompt).toContain("ex-squat")
  })
})

describe("validateProgram", () => {
  it("keeps valid exercises and fills names/images from the catalog", () => {
    const result = validateProgram(
      { goal: "Power", sessions: [session("2026-12-01", [{ id: "ex-squat", name_en: "WRONG NAME", section: "strength/power", sets: 3, reps: 8, load_percentage: 70 }])] },
      catalog,
      baseOptions,
    )
    expect(result.error).toBeNull()
    const exercise = result.program!.sessions[0].exercises[0]
    expect(exercise).toMatchObject({ id: "ex-squat", name_en: "Back Squat", section: "Strength/Power", sets: 3, reps: "8", image_url: "/squat.png" })
  })

  it("drops exercises that are not in the catalog and reports it", () => {
    const result = validateProgram(
      { sessions: [session("2026-12-01", [{ id: "ex-plank", sets: 2, reps: "30 sec" }, { id: "made-up", name_en: "Moon Jump" }])] },
      catalog,
      baseOptions,
    )
    expect(result.program!.sessions[0].exercises).toHaveLength(1)
    expect(result.program!.warnings.join(" ")).toMatch(/not in your catalog/)
  })

  it("rescues a wrong id by exact name", () => {
    const result = validateProgram({ sessions: [session("2026-12-01", [{ id: "bad", name_en: "plank" }])] }, catalog, baseOptions)
    expect(result.program!.sessions[0].exercises[0].id).toBe("ex-plank")
  })

  it("drops sessions outside the 4-week window or with invalid dates", () => {
    const result = validateProgram(
      {
        sessions: [
          session("2026-12-01", [{ id: "ex-plank" }]),
          session("2027-03-01", [{ id: "ex-plank" }]),
          session("not-a-date", [{ id: "ex-plank" }]),
          session("2026-12-03", []),
        ],
      },
      catalog,
      baseOptions,
    )
    expect(result.program!.sessions.map((s) => s.date)).toEqual(["2026-12-01"])
  })

  it("clamps numbers and moves sessions to the chosen training days", () => {
    const result = validateProgram({ sessions: [session("2026-12-02", [{ id: "ex-plank", sets: 99, load_percentage: 500 }])] }, catalog, baseOptions)
    const exercise = result.program!.sessions[0].exercises[0]
    expect(exercise.sets).toBe(10)
    expect(exercise.load_percentage).toBe(120)
    const moved = result.program!.sessions[0].date
    expect(baseOptions.weekdays).toContain(new Date(`${moved}T00:00:00Z`).getUTCDay())
    expect(result.program!.warnings.join(" ")).toMatch(/moved to your chosen training days/)
  })

  it("moves an off-day session to a free chosen day further away when the nearby ones are taken", () => {
    // Tue/Thu from Tue 1 Dec. Sat 5 has Thu 3 and Tue 8 taken nearby; Thu 10 is the nearest free one.
    const result = validateProgram(
      { sessions: ["2026-12-01", "2026-12-03", "2026-12-05", "2026-12-08"].map((date) => session(date, [{ id: "ex-plank" }])) },
      catalog,
      baseOptions,
    )
    expect(result.program!.sessions.map((s) => s.date)).toEqual(["2026-12-01", "2026-12-03", "2026-12-08", "2026-12-10"])
    expect(result.program!.warnings.join(" ")).not.toMatch(/not selected/)
  })

  it("expands a one-week template into 4 dated weeks with per-week load and sets", () => {
    const raw = {
      goal: "g", rationale: "r", warnings: [],
      week_template: [
        { day: 1, exercises: [{ id: "ex-plank", section: "Strength/Power", sets: 3, reps: "8", load_by_week: [60, 70, 80, 85], sets_by_week: [3, 3, 4, 4] }] },
        { day: 2, exercises: [{ id: "ex-plank", section: "Accessory", sets: 2, reps: "10", load_by_week: null }] },
      ],
    }
    const expanded = expandWeekTemplate(raw, { startDate: "2026-12-01", weekdays: [2, 4], time: "18:00" }) as { sessions: { date: string; week: number; exercises: { load_percentage?: number; sets: number; section: string }[] }[] }
    expect(expanded.sessions.map((s) => s.date)).toEqual(["2026-12-01", "2026-12-03", "2026-12-08", "2026-12-10", "2026-12-15", "2026-12-17", "2026-12-22", "2026-12-24"])
    expect(expanded.sessions.map((s) => s.week)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
    expect(expanded.sessions.filter((s) => s.exercises[0].section === "Strength/Power").map((s) => [s.exercises[0].load_percentage, s.exercises[0].sets])).toEqual([[60, 3], [70, 3], [80, 4], [85, 4]])
    const result = validateProgram(expanded, catalog, baseOptions)
    expect(result.error).toBeNull()
    expect(result.program!.sessions).toHaveLength(8)
    // Old "sessions" format passes through unchanged.
    const old = { sessions: [session("2026-12-01", [{ id: "ex-plank" }])] }
    expect(expandWeekTemplate(old, { startDate: "2026-12-01", weekdays: [2], time: "18:00" })).toBe(old)
  })

  it("fails when nothing valid is left", () => {
    expect(validateProgram({ sessions: [session("2026-12-01", [{ id: "nope" }])] }, catalog, baseOptions).error).toMatch(/no valid sessions/)
    expect(validateProgram({}, catalog, baseOptions).error).toMatch(/no sessions/)
    expect(validateProgram("text", catalog, baseOptions).error).toMatch(/not a JSON object/)
  })
})

describe("validatePromptText", () => {
  it("accepts reasonable prompts and rejects empty or huge ones", () => {
    expect(validatePromptText("You are a careful strength coach. Always answer with valid JSON only.")).toBeTruthy()
    expect(validatePromptText("short")).toBeNull()
    expect(validatePromptText("x".repeat(5000))).toBeNull()
    expect(validatePromptText(42)).toBeNull()
  })
})
