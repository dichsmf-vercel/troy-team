import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ user: null as { id: string } | null, role: null as string | null }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.role ? { role: state.role } : null }) }) }),
    }),
  }),
}))

import { requireAdmin, requireStaff, requireUser } from "@/lib/auth/guards"

beforeEach(() => {
  state.user = null
  state.role = null
})

describe("auth guards", () => {
  it("rejects anonymous callers everywhere", async () => {
    for (const guard of [requireUser, requireStaff, requireAdmin]) {
      expect(await guard()).toEqual({ ok: false, error: "Unauthorized" })
    }
  })

  it("lets any signed-in user through requireUser", async () => {
    state.user = { id: "u1" }
    state.role = "athlete"
    expect(await requireUser()).toMatchObject({ ok: true, ctx: { role: "athlete" } })
  })

  it("blocks athletes from staff and admin actions with the given message", async () => {
    state.user = { id: "u1" }
    state.role = "athlete"
    expect(await requireStaff()).toEqual({ ok: false, error: "Forbidden" })
    expect(await requireAdmin("Only admins can edit athletes.")).toEqual({ ok: false, error: "Only admins can edit athletes." })
  })

  it("treats a user without a profile as no role", async () => {
    state.user = { id: "u1" }
    expect(await requireStaff()).toMatchObject({ ok: false })
  })

  it("lets supporting coaches do staff work but not admin work", async () => {
    state.user = { id: "u2" }
    state.role = "supporting_coach"
    expect(await requireStaff()).toMatchObject({ ok: true })
    expect(await requireAdmin()).toMatchObject({ ok: false })
  })

  it("lets admins do everything", async () => {
    state.user = { id: "u3" }
    state.role = "admin"
    expect(await requireStaff()).toMatchObject({ ok: true })
    expect(await requireAdmin()).toMatchObject({ ok: true })
  })
})
