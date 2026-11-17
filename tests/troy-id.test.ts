import { describe, expect, it } from "vitest"
import { generateTroyId, isTroyId, troyIdToEmail } from "@/lib/troy-id"

describe("troy id", () => {
  it("generates ids that validate and avoid confusing characters", () => {
    for (let i = 0; i < 200; i++) {
      const id = generateTroyId()
      expect(isTroyId(id)).toBe(true)
      expect(id.slice(5)).not.toMatch(/[IO01]/)
    }
  })

  it("maps to the internal login email", () => {
    expect(troyIdToEmail(" TROY-A3X9K2M ")).toBe("troy-a3x9k2m@troy.internal")
  })

  it("rejects look-alikes", () => {
    expect(isTroyId("TROY-ABC")).toBe(false)
    expect(isTroyId("TROY-ABCDEF0")).toBe(false)
    expect(isTroyId("me@example.com")).toBe(false)
  })
})
