import { describe, expect, it } from "vitest"
import { safeNextPath } from "@/lib/safe-redirect"

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/auth/set-password")).toBe("/auth/set-password")
    expect(safeNextPath("/program?week=2#top")).toBe("/program?week=2#top")
  })

  it("uses the fallback for empty input", () => {
    expect(safeNextPath(null, "/x")).toBe("/x")
    expect(safeNextPath("", "/x")).toBe("/x")
    expect(safeNextPath(undefined)).toBe("/")
  })

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "@evil.com",
    "evil.com",
    "javascript:alert(1)",
    "/ok\nSet-Cookie: x=1",
    "/\tevil",
  ])("blocks %j", (value) => {
    expect(safeNextPath(value, "/safe")).toBe("/safe")
  })
})
