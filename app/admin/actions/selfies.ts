"use server"

import { revalidatePath } from "next/cache"
import { requireStaff } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"

/** Review (and delete) a per-exercise program selfie. Files live in the "exercise-selfies" bucket. */
export async function markExerciseSelfieReviewed(selfieId: string) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }

  const service = createAdminClient()
  const { data: selfie, error: loadError } = await service
    .from("program_exercise_selfies")
    .select("storage_path")
    .eq("id", selfieId)
    .single()
  if (loadError || !selfie) return { error: loadError?.message || "Selfie not found." }

  const { error: fileError } = await service.storage.from("exercise-selfies").remove([selfie.storage_path])
  if (fileError) return { error: fileError.message }

  const { error } = await service.from("program_exercise_selfies").delete().eq("id", selfieId)
  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { error: null }
}

/** Review (and delete) a session exercise selfie. Files live in the "session-selfies" bucket. */
export async function reviewSessionSelfie(selfieId: string) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }

  const service = createAdminClient()
  const { data: selfie, error: loadError } = await service
    .from("session_exercise_selfies")
    .select("storage_path")
    .eq("id", selfieId)
    .single()
  if (loadError || !selfie) return { error: loadError?.message || "Selfie not found." }

  const { error: fileError } = await service.storage.from("session-selfies").remove([selfie.storage_path])
  if (fileError) return { error: fileError.message }

  const { error } = await service.from("session_exercise_selfies").delete().eq("id", selfieId)
  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { error: null }
}

/** Marks a legacy session selfie as reviewed. */
export async function reviewSelfie(id: string) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.ctx.supabase
    .from("session_selfies")
    .update({ reviewed: true, reviewed_by: auth.ctx.user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}
