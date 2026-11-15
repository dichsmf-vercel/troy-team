/**
 * Troy ID utilities
 * Format: TROY-XXXXXXX (7 uppercase alphanumeric chars)
 * Used as the athlete-facing login identifier instead of email.
 * Internally stored in profiles.troy_id.
 * Auth email is generated as: troy-<lowercase_id>@troy.internal
 */

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no I, O, 0, 1 — avoids confusion
const TROY_ID_PATTERN = /^TROY-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/i

export function generateTroyId(): string {
  let id = "TROY-"
  // Use crypto.getRandomValues if available (browser/edge), fallback to Math.random
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(7)
    crypto.getRandomValues(bytes)
    for (const byte of bytes) id += CHARS[byte % CHARS.length]
  } else {
    for (let i = 0; i < 7; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return id
}

/**
 * Converts a Troy ID to the internal fake email used for Supabase Auth.
 * e.g. "TROY-A3X9K2M" → "troy-a3x9k2m@troy.internal"
 */
export function troyIdToEmail(troyId: string): string {
  return `${troyId.trim().toLowerCase()}@troy.internal`
}

/**
 * Returns true if the given string looks like a Troy ID (TROY-XXXXXXX)
 */
export function isTroyId(value: string): boolean {
  return typeof value === "string" && TROY_ID_PATTERN.test(value.trim())
}
