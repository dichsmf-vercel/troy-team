import type { ParsedAthleteRow } from "@/lib/excel-import"

/** Max rows accepted by one server-action call. The client sends bigger files in chunks. */
export const IMPORT_CHUNK_SIZE = 15
export const IMPORT_MAX_ROWS_PER_CALL = 25

const FMS_KEYS = [
  "deepSquat",
  "hurdleStep",
  "inlineLunge",
  "shoulderMobility",
  "activeStraightLegRaise",
  "trunkStability",
  "rotaryStability",
] as const

const METRIC_KEYS = [
  "birthYear",
  ...FMS_KEYS,
  "verticalJumpCm",
  "horizontalJumpCm",
  "sprint20mSec",
  "tTestSec",
  "agility505RSec",
  "agility505LSec",
  "pushUps",
  "pullUps",
  "plankSec",
  "beepTestLevel",
  "rowMachineResult",
] as const

/** Normalises a name so "أحمد  هاني" / "احمد هاني" / "AHMED" compare equal. */
export function nameKey(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "") // Arabic diacritics + tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase()
}

export type ImportValidation = { ok: true; rows: ParsedAthleteRow[] } | { ok: false; error: string }

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null)

export function validateImportRows(input: unknown): ImportValidation {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: "The spreadsheet has no athlete rows." }
  if (input.length > IMPORT_MAX_ROWS_PER_CALL) {
    return { ok: false, error: `Too many rows in one request (max ${IMPORT_MAX_ROWS_PER_CALL}).` }
  }

  const rows: ParsedAthleteRow[] = []
  for (const [index, raw] of input.entries()) {
    const row = raw as ParsedAthleteRow | null
    const label = `Row ${row?.rowNumber ?? index + 1}`
    if (!row || typeof row !== "object") return { ok: false, error: `${label} is not valid.` }

    const fullName = text(row.fullName)
    if (!fullName) return { ok: false, error: `${label} is missing the athlete name.` }
    if (fullName.length > 120) return { ok: false, error: `${label} has a name longer than 120 characters.` }

    for (const key of METRIC_KEYS) {
      const value = row[key]
      if (value != null && (typeof value !== "number" || !Number.isFinite(value))) {
        return { ok: false, error: `${label} has an invalid numeric value.` }
      }
    }
    for (const key of FMS_KEYS) {
      const score = row[key]
      if (score != null && (!Number.isInteger(score) || score < 0 || score > 3)) {
        return { ok: false, error: `${label} has an FMS score outside the 0–3 range.` }
      }
    }

    rows.push({
      ...row,
      rowNumber: Number.isInteger(row.rowNumber) ? row.rowNumber : index + 1,
      fullName,
      clubName: text(row.clubName),
      sport: text(row.sport) ?? "Not Set",
      position: text(row.position) ?? "Not Set",
      assessmentDate: text(row.assessmentDate),
      rawNotes: text(row.rawNotes),
    })
  }
  return { ok: true, rows }
}

/** Per-row problems for the preview in the import dialog (the server re-checks everything). */
export function findRowProblems(rows: ParsedAthleteRow[]): { rowNumber: number; message: string }[] {
  const problems: { rowNumber: number; message: string }[] = []
  for (const row of rows) {
    const single = validateImportRows([row])
    if (!single.ok) problems.push({ rowNumber: row.rowNumber, message: single.error.replace(/^Row \d+ /, "") })
  }
  return problems
}
