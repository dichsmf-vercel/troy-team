"use server"

import { requireUser } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { getT } from "@/lib/i18n/get-language"

/**
 * Sets the signed-in user's own password and clears the forced-change flag.
 * Runs on the server with the service role: athletes may not be allowed to
 * update their own profiles row under RLS, which left the flag on and sent them
 * straight back to this page after saving.
 */
export async function saveOwnPassword(password: string) {
  const t = await getT()
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }
  if (typeof password !== "string" || password.length < 8) {
    return { error: t("Password must be at least 8 characters.") }
  }

  const service = createAdminClient()
  const { error } = await service.auth.admin.updateUserById(auth.ctx.user.id, { password })
  if (error) return { error: error.message }

  const { error: flagError } = await service
    .from("profiles")
    .update({ password_change_required: false })
    .eq("id", auth.ctx.user.id)
  if (flagError) return { error: flagError.message }

  return { error: null }
}
