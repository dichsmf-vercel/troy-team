/**
 * The coach prompt = a fixed base prompt + a growing list of short, GENERAL preferences learned from
 * the coach's edits. Edits only ever ADD preferences; they never rewrite the base (an edit to one
 * athlete's program must not turn every future program into that athlete's program).
 * Pure functions, shared by the server actions and the proposals panel.
 */

export const DEFAULT_COACH_PROMPT = `You are an expert strength and conditioning coach for Egyptian athletes.
You specialize in sport-specific training for handball, football, basketball, volleyball, and hockey.
Design evidence-based, periodized programs that are safe, progressive, and respect the athlete's limitations.
Always produce valid JSON with no extra commentary outside the JSON block.`

const HEADING_START = "## Coach preferences"
const HEADING = `${HEADING_START} (from the head coach's edits; a later line overrides an earlier one, athlete safety overrides all)`

/** Keeps the list plus the base prompt below validatePromptText's 4000-character limit. */
export const MAX_PREFERENCES = 18
const MAX_RULE_LENGTH = 160
const MIN_RULE_LENGTH = 12
const MAX_NEW_RULES = 3

const ruleKey = (rule: string) => rule.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()

function split(prompt: string): { base: string; rules: string[] } {
  const at = prompt.indexOf(HEADING_START)
  if (at === -1) return { base: prompt.trim(), rules: [] }
  const rules = prompt
    .slice(at)
    .split("\n")
    .slice(1)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
  return { base: prompt.slice(0, at).trim(), rules }
}

export function listPreferences(prompt: string | null | undefined): string[] {
  return prompt ? split(prompt).rules : []
}

/** Adds rules to a prompt (or to the built-in one), skipping repeats and dropping the oldest when full. */
export function mergePreferences(currentPrompt: string | null | undefined, added: string[]): string {
  const { base, rules } = split(currentPrompt?.trim() || DEFAULT_COACH_PROMPT)
  const seen = new Set<string>()
  const merged = [...rules, ...added].filter((rule) => {
    const key = ruleKey(rule)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (!merged.length) return base
  return `${base}\n\n${HEADING}\n${merged.slice(-MAX_PREFERENCES).map((rule) => `- ${rule}`).join("\n")}`
}

/** The preferences a proposal has that the current prompt does not. */
export function newPreferences(currentPrompt: string | null | undefined, proposedPrompt: string): string[] {
  const known = new Set(listPreferences(currentPrompt).map(ruleKey))
  return listPreferences(proposedPrompt).filter((rule) => !known.has(ruleKey(rule)))
}

/** Sanitises the AI's "rules" answer: at most 3 single-line rules of reasonable length. */
export function cleanPreferenceRules(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").replace(/^[\s#*\-•]+/, "").trim())
    .filter((item) => item.length >= MIN_RULE_LENGTH && item.length <= MAX_RULE_LENGTH)
    .slice(0, MAX_NEW_RULES)
}
