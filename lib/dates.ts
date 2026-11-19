/**
 * The club trains in Egypt. Servers run in UTC, so "today" computed with toISOString()
 * is yesterday between 00:00 and 02:00/03:00 Cairo time. Use these helpers for any
 * athlete-facing "today" logic.
 */
export const APP_TIME_ZONE = "Africa/Cairo"

/** YYYY-MM-DD for a moment, in the club's time zone. */
export function isoDateInAppZone(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

export function todayInAppZone(): string {
  return isoDateInAppZone(new Date())
}

/** Adds whole days to a YYYY-MM-DD string (calendar math, no time-zone drift). */
export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
