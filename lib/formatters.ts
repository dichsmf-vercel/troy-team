export function safeDate(value: unknown, locale = "en-US", options?: Intl.DateTimeFormatOptions) {
  if (value === null || value === undefined || value === "") return "—"
  const raw = String(value)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw)
  if (Number.isNaN(date.getTime())) {
    console.error("[v0] invalid date value", { value, locale })
    return "—"
  }
  try {
    return date.toLocaleDateString(locale, options)
  } catch (error) {
    console.error("[v0] date formatting failed", { value, locale, error })
    return "—"
  }
}

export function safeTime(value: unknown, locale = "en-US") {
  if (value === null || value === undefined || value === "") return "—"
  const raw = String(value).slice(0, 5)
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (!match) return "—"
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return "—"
  const date = new Date(1970, 0, 1, hours, minutes)
  try {
    return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
  } catch (error) {
    console.error("[v0] time formatting failed", { value, locale, error })
    return "—"
  }
}

export function logPageHealth(page: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") console.log(`[v0] ${page} health`, details)
}
