/** Small, typed FormData readers shared by server actions. */

export function formString(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === "string" ? value.trim() : ""
}

/** Positive finite number, otherwise null. */
export function formNumber(form: FormData, key: string): number | null {
  const raw = form.get(key)
  if (raw === null || raw === "") return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Any finite number (zero allowed), otherwise null. */
export function formFiniteNumber(form: FormData, key: string): number | null {
  const raw = form.get(key)
  if (raw === null || raw === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function formDays(form: FormData, key: string): number[] {
  return form
    .getAll(key)
    .map((value) => Number(value))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
}

export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  return error instanceof Error ? error.message : typeof error === "string" ? error : fallback
}
