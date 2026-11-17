import { afterEach, describe, expect, it, vi } from "vitest"
import { getSiteUrl, normalizeSiteUrl } from "@/lib/site-url"

afterEach(() => vi.unstubAllEnvs())

function stub(env: Record<string, string>) {
  for (const key of ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL", "VERCEL_URL"]) {
    vi.stubEnv(key, env[key] ?? "")
  }
}

describe("normalizeSiteUrl", () => {
  it("adds https and strips paths and trailing slashes", () => {
    expect(normalizeSiteUrl("troy.example.com/")).toBe("https://troy.example.com")
    expect(normalizeSiteUrl("https://troy.example.com/app/")).toBe("https://troy.example.com")
  })
  it("rejects empty input", () => {
    expect(normalizeSiteUrl("")).toBeNull()
    expect(normalizeSiteUrl(undefined)).toBeNull()
  })
})

describe("getSiteUrl", () => {
  it("prefers the explicit site url", () => {
    vi.stubEnv("NODE_ENV", "production")
    stub({ NEXT_PUBLIC_SITE_URL: "https://troy.example.com", VERCEL_PROJECT_PRODUCTION_URL: "other.vercel.app" })
    expect(getSiteUrl()).toBe("https://troy.example.com")
  })

  it("falls back to the Vercel production url", () => {
    vi.stubEnv("NODE_ENV", "production")
    stub({ VERCEL_PROJECT_PRODUCTION_URL: "troy-team.vercel.app" })
    expect(getSiteUrl()).toBe("https://troy-team.vercel.app")
  })

  it("never returns localhost in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    stub({})
    expect(getSiteUrl()).toBeNull()
  })

  it("uses localhost in development", () => {
    vi.stubEnv("NODE_ENV", "development")
    stub({})
    expect(getSiteUrl()).toBe("http://localhost:3000")
  })
})
