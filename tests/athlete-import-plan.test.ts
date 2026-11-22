import { describe, expect, it } from "vitest"
import { isSameAthlete, matchRow, planAssessment, rowResults, withFmsTotal, type KnownAthlete } from "@/lib/admin/athlete-import-plan"
import type { ParsedAthleteRow } from "@/lib/excel-import"

const known = (id: string, birthYear: number | null, teams: string[] = []): KnownAthlete => ({ id, birthYear, teamIds: new Set(teams) })
const row = (extra: Partial<ParsedAthleteRow> = {}): ParsedAthleteRow => ({ rowNumber: 2, fullName: "Test Athlete", ...extra })
const FULL_FMS = { deepSquat: 2, hurdleStep: 2, inlineLunge: 2, shoulderMobility: 2, activeStraightLegRaise: 2, trunkStability: 2, rotaryStability: 2 }
const SAVED_FMS = { deep_squat: 2, hurdle_step: 2, inline_lunge: 2, shoulder_mobility: 2, active_straight_leg_raise: 2, trunk_stability: 2, rotary_stability: 2, fms_total: 14 }

describe("matching a row to an athlete", () => {
  it("uses birth year when both are known, otherwise the club", () => {
    expect(isSameAthlete(known("a", 2010, ["t1"]), 2010, "t2")).toBe(true)
    expect(isSameAthlete(known("a", 2010, ["t1"]), 2011, "t1")).toBe(false)
    expect(isSameAthlete(known("a", null, ["t1"]), 2011, "t1")).toBe(true)
    expect(isSameAthlete(known("a", null, ["t1"]), null, "t2")).toBe(false)
    expect(isSameAthlete(known("a", null), null, null)).toBe(true)
    expect(isSameAthlete(known("a", 2010), null, "t1")).toBe(false)
  })

  it("never guesses between two possible athletes", () => {
    const twins = [known("a", null, ["t1"]), known("b", null, ["t1"])]
    expect(matchRow(twins, null, "t1")).toEqual({ kind: "ambiguous" })
    expect(matchRow([twins[0], twins[0]], null, "t1")).toEqual({ kind: "existing", known: twins[0] })
  })

  it("marks a new athlete that shares a name with someone else", () => {
    expect(matchRow([known("a", 2010)], 2012, null)).toEqual({ kind: "new", sameName: true })
    expect(matchRow([], 2012, null)).toEqual({ kind: "new", sameName: false })
  })
})

describe("planning test results", () => {
  const today = "2026-11-22"
  it("reads only filled cells and totals only a complete FMS battery", () => {
    expect(rowResults(row({ deepSquat: 0, pushUps: null, plankSec: 60 }))).toEqual({ deep_squat: 0, plank_seconds: 60 })
    expect(withFmsTotal(rowResults(row(FULL_FMS))).fms_total).toBe(14)
    expect(withFmsTotal({ deep_squat: 2, fms_total: 14 })).toEqual({ deep_squat: 2 })
  })

  it("does nothing when the sheet has no results or the same results", () => {
    expect(planAssessment({ date: "2026-11-18T12:00:00Z", status: "draft", results: SAVED_FMS }, row(FULL_FMS), today)).toEqual({ action: "none" })
    expect(planAssessment({ date: null, status: "draft", results: { push_ups: 20 } }, row(), today)).toEqual({ action: "none" })
  })

  it("adds a new record for a new date and carries over results the sheet does not have", () => {
    const plan = planAssessment({ date: "2026-11-18T12:00:00Z", status: "draft", results: { ...SAVED_FMS, push_ups: 20 } }, row({ deepSquat: 3 }), today)
    expect(plan).toMatchObject({ action: "insert", changed: ["deep_squat"], removed: [] })
    expect(plan.action === "insert" && plan.results).toMatchObject({ deep_squat: 3, fms_total: 15, push_ups: 20 })
  })

  it("corrects the same day's draft in place, but never a reviewed record", () => {
    const saved = { date: "2026-11-18T12:00:00Z", status: "draft", results: { push_ups: 20 } }
    expect(planAssessment(saved, row({ assessmentDate: "2026-11-18", pushUps: 25 }), today).action).toBe("update")
    expect(planAssessment({ ...saved, status: "approved" }, row({ assessmentDate: "2026-11-18", pushUps: 25 }), today).action).toBe("insert")
    expect(planAssessment({ ...saved, date: "2026-11-22T08:00:00Z" }, row({ pushUps: 25 }), today).action).toBe("update")
  })

  it("keeps newer results when the sheet is older", () => {
    expect(planAssessment({ date: "2026-11-18T12:00:00Z", status: "draft", results: { push_ups: 20 } }, row({ assessmentDate: "2026-10-01", pushUps: 10 }), today)).toEqual({ action: "older" })
  })

  it("does not call a sheet older than results whose date is only the import day", () => {
    const saved = { date: "2026-11-18T12:00:00Z", status: "draft", results: { push_ups: 20 }, dateIsImportDay: true }
    expect(planAssessment(saved, row({ assessmentDate: "2026-10-01", pushUps: 25 }), today)).toMatchObject({ action: "update", changed: ["push_ups"] })
    expect(planAssessment(saved, row({ assessmentDate: "2026-11-20", pushUps: 25 }), today).action).toBe("insert")
  })

  it("keeps a coach-entered FMS total when the FMS cells did not change", () => {
    const plan = planAssessment({ date: "2026-11-18", status: "draft", results: { fms_total: 15 } }, row({ pushUps: 30 }), today)
    expect(plan.action === "insert" && plan.results).toEqual({ fms_total: 15, push_ups: 30 })
  })

  it("drops a total that no longer matches incomplete scores", () => {
    const plan = planAssessment({ date: "2026-11-22", status: "draft", results: { fms_total: 15 } }, row({ deepSquat: 1 }), today)
    expect(plan).toMatchObject({ action: "update", removed: ["fms_total"], results: { deep_squat: 1 } })
  })

  it("inserts for an athlete without any record", () => {
    expect(planAssessment(null, row({ pushUps: 12 }), today)).toEqual({ action: "insert", results: { push_ups: 12 }, removed: [], changed: ["push_ups"] })
  })
})
