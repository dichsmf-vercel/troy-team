import { describe, expect, it } from "vitest"
import { describeProgramEdits, sessionVolumeWarnings } from "@/lib/program-edits"
import type { GeminiExercise, GeminiProgramOutput } from "@/lib/gemini-types"

const ex = (id: string, section = "Strength/Power", extra: Partial<GeminiExercise> = {}): GeminiExercise => ({ id, name_en: id, section, sets: 3, reps: "8", ...extra })
const program = (exercises: GeminiExercise[]): GeminiProgramOutput => ({ goal: "g", rationale: "r", warnings: [], sessions: [{ date: "2026-12-01", time: "18:00", week: 1, exercises }] })

describe("describeProgramEdits", () => {
  it("reports added, removed, replaced, moved and detail changes with counts", () => {
    const before = program([ex("Warmup", "Warm-up"), ex("Squat"), ex("Plank", "Accessory"), ex("Stretch", "Cooldown")])
    const after = program([ex("Warmup", "Warm-up"), ex("Deadlift"), ex("Stretch", "Cooldown"), ex("Bench", "Strength/Power", { sets: 4 }), ex("Row")])
    const lines = describeProgramEdits(before, after)
    expect(lines).toHaveLength(1)
    const text = lines[0]
    expect(text).toContain("replaced Squat [Strength/Power] with Deadlift [Strength/Power] at position 2")
    expect(text).toContain("moved Stretch from position 4 to 3")
    expect(text).toContain("added Bench [Strength/Power] at position 4")
    expect(text).toContain("removed Plank [Accessory]")
    expect(text).toContain("Exercises 4→5, strength/power 1→3")
  })

  it("reports set/rep/load changes and stays empty when nothing changed", () => {
    const before = program([ex("Squat", "Strength/Power", { load_percentage: 70 })])
    const after = program([ex("Squat", "Strength/Power", { sets: 5, reps: "5", load_percentage: 80 })])
    expect(describeProgramEdits(before, after)[0]).toContain("Squat: sets 3→5, reps 8→5, load 70%→80%")
    expect(describeProgramEdits(before, before)).toEqual([])
  })
})

describe("sessionVolumeWarnings", () => {
  it("flags sessions under 6 exercises or under 2 strength exercises", () => {
    const thin = program([ex("A", "Warm-up"), ex("B"), ex("C", "Accessory"), ex("D", "Accessory"), ex("E", "Cooldown")])
    expect(sessionVolumeWarnings(thin)).toEqual([{ date: "2026-12-01", total: 5, strength: 1 }])
    const ok = program([ex("A", "Warm-up"), ex("B"), ex("C"), ex("D", "Accessory"), ex("E", "Accessory"), ex("F", "Cooldown")])
    expect(sessionVolumeWarnings(ok)).toEqual([])
  })
})
