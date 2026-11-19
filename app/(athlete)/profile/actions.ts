"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { getT } from "@/lib/i18n/get-language"

/** Returns the signed-in athlete's parent access code, creating one if they have none yet. */
export async function ensureParentCode(): Promise<{ error: string | null; code?: string }> {
  const t = await getT()
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }
  if (auth.ctx.role !== "athlete") return { error: t("Only athletes have a parent access code.") }

  const service = createAdminClient()
  const { data: athlete } = await service.from("athletes").select("parent_link_code").eq("id", auth.ctx.user.id).maybeSingle()
  if (athlete?.parent_link_code) return { error: null, code: athlete.parent_link_code }

  const code = randomBytes(6).toString("hex")
  const { error } = await service.from("athletes").update({ parent_link_code: code }).eq("id", auth.ctx.user.id)
  if (error) return { error: error.message }

  revalidatePath("/profile")
  return { error: null, code }
}

/** Updates the signed-in user's own display name. */
export async function updateOwnName(fullName: string): Promise<{ error: string | null }> {
  const t = await getT()
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }
  const name = typeof fullName === "string" ? fullName.trim().slice(0, 120) : ""
  if (!name) return { error: t("Full name is required.") }

  const { error } = await auth.ctx.supabase.from("profiles").update({ full_name: name, updated_at: new Date().toISOString() }).eq("id", auth.ctx.user.id)
  if (error) return { error: error.message }
  revalidatePath("/profile")
  return { error: null }
}
