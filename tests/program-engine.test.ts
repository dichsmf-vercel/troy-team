import { describe, expect, it } from "vitest"
import { generateFourWeekProgram, type EngineExercise } from "@/lib/program-engine"

const ex = (id: string, name_en: string, category: string): EngineExercise => ({ id, name_en, category })
const catalog: EngineExercise[] = [
  ex("e1", "Barbell Back Squat", "Lower Body"),
  ex("e2", "Bulgarian Split Squat", "Lower Body"),
  ex("e3", "Barbell Hip Thrust", "Lower Body"),
  ex("e4", "Barbell Bench Press", "Upper Body"),
  ex("e5", "Pull-Ups", "Upper Body"),
  ex("e6", "Seated Cable Row", "Upper Body"),
  ex("e7", "Box Jumps", "Power"),
  ex("e8", "Ab Wheel Rollout", "Core"),
  ex("e9", "Pallof Press", "Core"),
  ex("e10", "Cat-Cow", "Mobility"),
  ex("e11", "90/90 Hip Stretch", "Mobility"),
  ex("e12", "Wall Slides", "Mobility"),
  ex("e13", "Brettzel Stretch", "Mobility"),
  ex("e14", "Carioca Drill", "Agility"),
  ex("e15", "Agility Ladder Drills", "Agility"),
  ex("e16", "Band Pull-Aparts", "Upper Body"),
]

const sessions = generateFourWeekProgram({ startDate: "2026-11-23", weekdays: [1, 3, 5], time: "18:00", exercises: catalog })
const category = (id: string) => catalog.find((item) => item.id === id)?.category

describe("rules engine program", () => {
  it("never repeats an exercise inside one session", () => {
    for (const session of sessions) {
      const ids = session.exercises.map((exercise) => exercise.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("keeps lower-body lifts out of upper-body days (name matching put Back Squat there)", () => {
    const upperDays = sessions.filter((session) => session.focus === "Upper Body Focus")
    expect(upperDays.length).toBeGreaterThan(0)
    for (const session of upperDays) {
      const main = session.exercises.filter((exercise) => exercise.section === "Strength / Power")
      expect(main.every((exercise) => category(exercise.id) === "Upper Body")).toBe(true)
    }
  })

  it("warms up with agility/mobility work, not core or heavy lifts", () => {
    for (const session of sessions) {
      const warmups = session.exercises.filter((exercise) => exercise.section === "Warm-up")
      expect(warmups.every((exercise) => ["Agility", "Mobility"].includes(category(exercise.id) ?? ""))).toBe(true)
    }
  })
})
