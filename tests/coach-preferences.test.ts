import { describe, expect, it } from "vitest"
import { cleanPreferenceRules, DEFAULT_COACH_PROMPT, listPreferences, mergePreferences, MAX_PREFERENCES, newPreferences } from "@/lib/coach-preferences"
import { validatePromptText } from "@/lib/gemini-validate"

describe("coach preferences", () => {
  it("keeps the built-in prompt and appends rules below it", () => {
    const merged = mergePreferences(null, ["Prefer unilateral leg strength over bilateral."])
    expect(merged.startsWith(DEFAULT_COACH_PROMPT)).toBe(true)
    expect(listPreferences(merged)).toEqual(["Prefer unilateral leg strength over bilateral."])
  })

  it("adds to earlier rules instead of replacing them, and never repeats one", () => {
    const first = mergePreferences(null, ["Use at least 3 strength exercises."])
    const second = mergePreferences(first, ["use at least 3 strength exercises", "Avoid jumps in warm-ups."])
    expect(listPreferences(second)).toEqual(["Use at least 3 strength exercises.", "Avoid jumps in warm-ups."])
    expect(second.startsWith(DEFAULT_COACH_PROMPT)).toBe(true)
  })

  it("keeps a custom prompt the coach already had", () => {
    const custom = "You are Coach Ahmed's assistant. Always answer with valid JSON only."
    expect(mergePreferences(custom, ["Start every session with mobility."]).startsWith(custom)).toBe(true)
  })

  it("two proposals built from the same prompt both survive approval", () => {
    const a = mergePreferences(null, ["Rule number one for everybody."])
    const b = mergePreferences(null, ["Rule number two for everybody."])
    const active = mergePreferences(mergePreferences(null, listPreferences(a)), listPreferences(b))
    expect(listPreferences(active)).toEqual(["Rule number one for everybody.", "Rule number two for everybody."])
  })

  it("shows only the rules a proposal would add", () => {
    const current = mergePreferences(null, ["Rule number one for everybody."])
    const proposal = mergePreferences(current, ["Rule number two for everybody."])
    expect(newPreferences(current, proposal)).toEqual(["Rule number two for everybody."])
    expect(newPreferences("", proposal)).toHaveLength(2)
  })

  it("cleans what the AI returns: max 3, one line, sane length, no headings or bullets", () => {
    expect(cleanPreferenceRules("nope")).toEqual([])
    expect(
      cleanPreferenceRules(["short", 5, "- Keep   mobility\nbefore strength work.", "# Put heavy lifts first in the session.", "Third usable rule here.", "Fourth usable rule here."]),
    ).toEqual(["Keep mobility before strength work.", "Put heavy lifts first in the session.", "Third usable rule here."])
    expect(cleanPreferenceRules(["x".repeat(500)])).toEqual([])
  })

  it("stays within the stored prompt limit and drops the oldest rules when full", () => {
    let prompt: string | null = null
    for (let i = 0; i < MAX_PREFERENCES + 5; i++) prompt = mergePreferences(prompt, [`Rule ${i} ${"y".repeat(140)}`])
    const rules = listPreferences(prompt)
    expect(rules).toHaveLength(MAX_PREFERENCES)
    expect(rules.at(-1)).toContain(`Rule ${MAX_PREFERENCES + 4} `)
    expect(validatePromptText(prompt)).toBeTruthy()
  })
})
