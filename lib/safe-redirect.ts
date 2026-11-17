/**
 * Returns a same-origin, path-only redirect target, or `fallback`.
 *
 * Blocks open-redirect tricks such as `//evil.com`, `/\evil.com`, `@evil.com`,
 * `https://evil.com`, and control characters.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback
  if (!next.startsWith("/")) return fallback
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback

  try {
    const base = "http://localhost"
    const url = new URL(next, base)
    if (url.origin !== base) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
