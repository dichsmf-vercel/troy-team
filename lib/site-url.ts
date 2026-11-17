/**
 * Public base URL of the deployed app, used for auth e-mail links (invitations).
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL                (set this explicitly in Vercel)
 *   2. VERCEL_PROJECT_PRODUCTION_URL       (provided automatically by Vercel)
 *   3. NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL (legacy name, still honoured)
 *   4. VERCEL_URL                          (preview deployments)
 *   5. http://localhost:3000               (local development ONLY)
 *
 * In production with nothing configured this returns null so callers can fail
 * loudly instead of e-mailing athletes a localhost link.
 */
export function getSiteUrl(): string | null {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const preview = process.env.VERCEL_URL

  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (production ? `https://${production}` : "") ||
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
    (preview ? `https://${preview}` : "") ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "")

  return normalizeSiteUrl(raw)
}

export function normalizeSiteUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim()
  if (!value) return null
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withProtocol)
    return url.origin
  } catch {
    return null
  }
}
