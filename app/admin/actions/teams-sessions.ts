"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, requireStaff } from "@/lib/auth/guards"
import { formString } from "@/lib/admin/forms"
import { getT } from "@/lib/i18n/get-language"

export async function createTeam(form: FormData) {
  const t = await getT()
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth.ctx

  const nameEn = formString(form, "name_en")
  if (!nameEn) return { error: t("Team name is required.") }

  const { error } = await supabase.from("teams").insert({
    name_en: nameEn,
    name_ar: formString(form, "name_ar") || nameEn,
    color_hex: formString(form, "color_hex") || "#2563eb",
    image_url: formString(form, "image_url") || null,
    is_national_team: form.get("is_national_team") === "true",
  })
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}

export async function updateTeam(id: string, values: { name_en: string; name_ar: string; color_hex: string }) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.ctx.supabase.from("teams").update(values).eq("id", id)
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}

export async function deleteTeam(id: string) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can delete teams."))
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.ctx.supabase.from("teams").delete().eq("id", id)
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}

export async function createSessionPost(form: FormData) {
  const t = await getT()
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const exerciseIds = form.getAll("exercise_id").map(String).filter(Boolean)
  if (!exerciseIds.length) return { error: t("Add at least one exercise before saving this assigned training.") }

  const targetType = formString(form, "target_type") || "team"
  const targetId = formString(form, "target_id")
  const sessionDate = formString(form, "session_date")
  const startTime = formString(form, "start_time")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || !/^\d{2}:\d{2}$/.test(startTime)) {
    return { error: t("Choose a valid session date and start time.") }
  }
  if (!targetId) return { error: t("Choose a team or athlete.") }

  const titleEn = formString(form, "title_en")
  const { data: session, error } = await supabase
    .from("session_posts")
    .insert({
      team_id: targetType === "team" ? targetId : null,
      athlete_id: targetType === "athlete" ? targetId : null,
      title_en: titleEn,
      title_ar: formString(form, "title_ar") || titleEn,
      notes: formString(form, "notes") || null,
      session_date: sessionDate,
      start_time: startTime,
      created_by: user.id,
    })
    .select("id")
    .single()
  if (error || !session) return { error: error?.message ?? t("Unable to create session") }

  const sets = form.getAll("exercise_sets")
  const reps = form.getAll("exercise_reps")
  const loads = form.getAll("exercise_load")
  const prescriptions = exerciseIds.map((exerciseId, index) => ({
    session_post_id: session.id,
    exercise_id: exerciseId,
    sets: Number(sets[index]) || 1,
    reps: Number(reps[index]) || 1,
    load_percentage: Number(loads[index]) || null,
    exercise_order: index,
  }))

  const { error: exerciseError } = await supabase.from("session_exercises").insert(prescriptions)
  if (exerciseError) {
    await supabase.from("session_posts").delete().eq("id", session.id)
    return { error: exerciseError.message }
  }

  revalidatePath("/admin")
  return { error: null }
}

export async function deleteSessionPost(id: string) {
  const t = await getT()
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  if (!id?.trim()) return { error: t("Missing session id") }

  const { error } = await auth.ctx.supabase.from("session_posts").delete().eq("id", id)
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}
