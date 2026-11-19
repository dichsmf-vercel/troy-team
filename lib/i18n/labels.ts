import { tx, type TFunction } from "@/lib/i18n/translate"

/** Status values stored in the database, shown through t(). Unknown values fall back to readable text. */
const STATUS_LABELS: Record<string, string> = {
  draft: tx("Draft"),
  submitted: tx("Submitted"),
  not_started: tx("Not started"),
  in_review: tx("In review"),
  pending_review: tx("Pending review"),
  approved: tx("Approved"),
  rejected: tx("Rejected"),
  active: tx("Active"),
  paused: tx("Paused"),
  completed: tx("Completed"),
}

export function statusLabel(t: TFunction, status: string | null | undefined, fallback = "Draft"): string {
  if (!status) return t(fallback)
  return t(STATUS_LABELS[status] ?? status.replaceAll("_", " "))
}

const SPORT_LABELS: Record<string, string> = {
  handball: tx("Handball"),
  football: tx("Football"),
  basketball: tx("Basketball"),
  volleyball: tx("Volleyball"),
  hockey: tx("Hockey"),
  swimming: tx("Swimming"),
  athletics: tx("Athletics"),
  other: tx("Other"),
}

/** "Not Set" / "none" / "" mean the coach left the field empty. */
export function isUnset(value: string | null | undefined): boolean {
  const key = String(value ?? "").trim().toLowerCase()
  return !key || key === "not set" || key === "none" || key === "-"
}

/** Free-text value or "" when unset (never shows "Not Set"). */
export function fieldValue(value: string | null | undefined): string {
  return isUnset(value) ? "" : String(value).trim()
}

/** "handball" → "Handball" / "كرة اليد". */
export function sportLabel(t: TFunction, sport: string | null | undefined): string {
  const key = String(sport ?? "").trim().toLowerCase()
  if (isUnset(key)) return ""
  return SPORT_LABELS[key] ? t(SPORT_LABELS[key]) : String(sport)
}
