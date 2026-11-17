import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

/**
 * Authorization guards for server actions.
 *
 * Server actions are public POST endpoints, so EVERY action must start with one
 * of these guards. Never rely on the UI hiding a button, or on RLS alone.
 *
 *   const auth = await requireAdmin("Only admins can edit athletes.")
 *   if (!auth.ok) return { error: auth.error }
 *   const { supabase, user } = auth.ctx
 */

export const ADMIN_ROLES = ["admin"] as const
export const STAFF_ROLES = ["admin", "supporting_coach"] as const

export type AuthContext = {
  supabase: SupabaseClient
  user: User
  role: string
}

export type AuthResult = { ok: true; ctx: AuthContext } | { ok: false; error: string }

async function authorize(allowed: readonly string[] | null, deniedMessage: string): Promise<AuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = typeof profile?.role === "string" ? profile.role : ""

  if (allowed && !allowed.includes(role)) return { ok: false, error: deniedMessage }
  return { ok: true, ctx: { supabase, user, role } }
}

/** Any signed-in user. */
export function requireUser(): Promise<AuthResult> {
  return authorize(null, "")
}

/** admin or supporting_coach. */
export function requireStaff(deniedMessage = "Forbidden"): Promise<AuthResult> {
  return authorize(STAFF_ROLES, deniedMessage)
}

/** admin only. */
export function requireAdmin(deniedMessage = "Only admins can do this."): Promise<AuthResult> {
  return authorize(ADMIN_ROLES, deniedMessage)
}

export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role)
}
