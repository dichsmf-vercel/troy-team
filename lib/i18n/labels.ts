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

/** "handball" → "Handball" / "كرة اليد". */
export function sportLabel(t: TFunction, sport: string | null | undefined): string {
  const key = String(sport ?? "").trim().toLowerCase()
  if (!key) return ""
  return SPORT_LABELS[key] ? t(SPORT_LABELS[key]) : String(sport)
}
