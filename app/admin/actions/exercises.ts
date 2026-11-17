"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, requireStaff } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { formNumber, formString } from "@/lib/admin/forms"

const YOUTUBE_URL = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i
const IMAGE_NAME = /\.(jpe?g|png|webp)$/i
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export async function createExercise(form: FormData) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const nameEn = formString(form, "name_en")
  if (!nameEn) return { error: "Exercise name is required." }
  const video = formString(form, "video_youtube_url")
  if (video && !YOUTUBE_URL.test(video)) return { error: "Enter a valid YouTube link." }

  const { error } = await supabase.from("exercises").insert({
    name_en: nameEn,
    name_ar: formString(form, "name_ar") || nameEn,
    category: formString(form, "category") || "general",
    description_en: formString(form, "description_en") || null,
    description_ar: formString(form, "description_ar") || null,
    image_url: formString(form, "image_url") || null,
    video_youtube_url: video || null,
    default_sets: formNumber(form, "default_sets"),
    default_reps: formString(form, "default_reps") || null,
    created_by: user.id,
  })
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}

export async function updateExercise(id: string, values: { image_url: string; video_youtube_url: string }) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  if (values.video_youtube_url && !YOUTUBE_URL.test(values.video_youtube_url)) return { error: "Enter a valid YouTube link." }

  const { error } = await auth.ctx.supabase.from("exercises").update(values).eq("id", id)
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}

export async function deleteExercise(id: string) {
  const auth = await requireAdmin("Only admins can delete exercises.")
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.ctx.supabase.from("exercises").delete().eq("id", id)
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}

export async function updateExerciseVideo(formData: FormData) {
  const auth = await requireAdmin("Only admins can edit exercise videos.")
  if (!auth.ok) return { error: auth.error }

  const video = formString(formData, "video_youtube_url")
  if (video && !YOUTUBE_URL.test(video)) return { error: "Enter a valid YouTube link." }

  const { error } = await createAdminClient()
    .from("exercises")
    .update({ video_youtube_url: video || null })
    .eq("id", formString(formData, "exercise_id"))
  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { error: null }
}

/** Uploads an exercise image (service role, so it MUST stay behind the staff guard) and/or sets its video. */
export async function updateExerciseMediaRemoved(formData: FormData) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }

  const exerciseId = formString(formData, "exercise_id")
  if (!exerciseId) return { error: "Missing exercise." }
  const youtube = formString(formData, "video_youtube_url")
  if (youtube && !YOUTUBE_URL.test(youtube)) return { error: "Enter a valid YouTube link." }

  const service = createAdminClient()
  let imageUrl: string | undefined

  const image = formData.get("image")
  if (image instanceof File && image.size) {
    if (!IMAGE_NAME.test(image.name) || !image.type.startsWith("image/")) return { error: "Image must be JPG, PNG, or WebP." }
    if (image.size > MAX_IMAGE_BYTES) return { error: "Image must be smaller than 8 MB." }

    const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "")
    const path = `exercises/${exerciseId}-${Date.now()}-${safeName}`
    const upload = await service.storage.from("exercise-media").upload(path, image, { contentType: image.type, upsert: false })
    if (upload.error) return { error: `Image upload failed: ${upload.error.message}` }
    imageUrl = service.storage.from("exercise-media").getPublicUrl(path).data.publicUrl
  }

  const { error } = await service
    .from("exercises")
    .update({ ...(imageUrl ? { image_url: imageUrl } : {}), video_youtube_url: youtube || null })
    .eq("id", exerciseId)
  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { error: null }
}
