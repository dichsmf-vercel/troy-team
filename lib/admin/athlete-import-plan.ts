import type { ParsedAthleteRow } from "@/lib/excel-import"

/**
 * Pure decisions for the Excel roster import: which existing athlete a row belongs to, and what a
 * re-import changes. Empty cells never change or erase anything.
 */

// ─── Matching ─────────────────────────────────────────────────────────────────

export type KnownAthlete = { id: string | null; birthYear: number | null; teamIds: Set<string> }

/**
 * Same player = same name (checked by the caller) AND
 *  - same birth year when both are known, otherwise
 *  - same club when either birth year is missing ("Mohamed Ahmed" is a common name: a name alone is not enough).
 */
export function isSameAthlete(existing: KnownAthlete, birthYear: number | null, teamId: string | null): boolean {
  if (existing.birthYear != null && birthYear != null) return existing.birthYear === birthYear
  if (teamId && existing.teamIds.size) return existing.teamIds.has(teamId)
  return existing.birthYear == null && birthYear == null && !teamId && !existing.teamIds.size
}

export type RowMatch = { kind: "new"; sameName: boolean } | { kind: "existing"; known: KnownAthlete } | { kind: "ambiguous" }

export function matchRow(sameName: KnownAthlete[], birthYear: number | null, teamId: string | null): RowMatch {
  const unique = [...new Set(sameName)]
  const matches = unique.filter((known) => isSameAthlete(known, birthYear, teamId))
  if (matches.length > 1) return { kind: "ambiguous" }
  if (matches.length === 1) return { kind: "existing", known: matches[0] }
  return { kind: "new", sameName: unique.length > 0 }
}

// ─── Test results ─────────────────────────────────────────────────────────────

const FMS_FIELDS = {
  deep_squat: "deepSquat",
  hurdle_step: "hurdleStep",
  inline_lunge: "inlineLunge",
  shoulder_mobility: "shoulderMobility",
  active_straight_leg_raise: "activeStraightLegRaise",
  trunk_stability: "trunkStability",
  rotary_stability: "rotaryStability",
} as const
const OTHER_FIELDS = {
  v_jump_cm: "verticalJumpCm",
  horizontal_jump_cm: "horizontalJumpCm",
  sprint_20m_seconds: "sprint20mSec",
  t_test_seconds: "tTestSec",
  agility_505_r_seconds: "agility505RSec",
  agility_505_l_seconds: "agility505LSec",
  push_ups: "pushUps",
  pull_ups: "pullUps",
  plank_seconds: "plankSec",
  beep_test_level: "beepTestLevel",
  row_machine_result: "rowMachineResult",
  row_machine_watts: "rowMachineWatts",
} as const
const FMS_KEYS = Object.keys(FMS_FIELDS)

/** Results the sheet row actually contains (no totals, no empty cells). */
export function rowResults(row: ParsedAthleteRow): Record<string, number> {
  const results: Record<string, number> = {}
  for (const [key, field] of Object.entries({ ...FMS_FIELDS, ...OTHER_FIELDS })) {
    const value = row[field]
    if (typeof value === "number" && Number.isFinite(value)) results[key] = value
  }
  return results
}

/** Adds fms_total when all seven movements are scored; an incomplete battery gets no (misleading) total. */
export function withFmsTotal(results: Record<string, unknown>): Record<string, unknown> {
  const { fms_total: _old, ...rest } = results
  const scores = FMS_KEYS.map((key) => rest[key])
  return scores.every((score) => typeof score === "number") ? { ...rest, fms_total: (scores as number[]).reduce((sum, score) => sum + score, 0) } : rest
}

/** `dateIsImportDay`: the sheet had no test date, so `date` only says when it was imported. */
export type SavedAssessment = { date: string | null; status: string; results: Record<string, unknown>; dateIsImportDay?: boolean }
export type AssessmentPlan =
  | { action: "none" }
  /** The sheet is dated before the results already saved: keep the newer ones. */
  | { action: "older" }
  /** `update` corrects the current draft of the same day; `insert` adds a new dated record and keeps the old one. */
  | { action: "insert" | "update"; results: Record<string, unknown>; removed: string[]; changed: string[] }

const isoDate = (value: string | null | undefined) => (value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null)

export function planAssessment(saved: SavedAssessment | null, row: ParsedAthleteRow, today: string): AssessmentPlan {
  const incoming = rowResults(row)
  const before = saved?.results ?? {}
  const changed = Object.keys(incoming).filter((key) => before[key] !== incoming[key])
  if (!changed.length) return { action: "none" }

  const rowDate = isoDate(row.assessmentDate)
  const savedDate = isoDate(saved?.date)
  const sheetIsEarlier = rowDate !== null && savedDate !== null && rowDate < savedDate
  if (sheetIsEarlier && !saved?.dateIsImportDay) return { action: "older" }

  // Screens show only the newest record, so results missing from this sheet are carried over.
  const merged = { ...before, ...incoming }
  const results = changed.some((key) => FMS_KEYS.includes(key)) ? withFmsTotal(merged) : merged
  const removed = Object.keys(before).filter((key) => !(key in results))
  // An earlier date than an import day is the real date of those undated results: correct them in place.
  const sameDay = !!saved && (savedDate === null || sheetIsEarlier || savedDate === (rowDate ?? today))
  return { action: sameDay && saved.status === "draft" ? "update" : "insert", results, removed, changed }
}
