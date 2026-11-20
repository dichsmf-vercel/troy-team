"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, requireStaff, requireUser } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { getT } from "@/lib/i18n/get-language"
import { formString } from "@/lib/admin/forms"

const RULES_PROGRAM_NAME = "Coach Ahmed Rules Engine"

export async function createProgram(form: FormData) {
  const t = await getT()
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const nameEn = formString(form, "name_en")
  if (!nameEn) return { error: t("Program name is required.") }

  const { data: program, error } = await supabase
    .from("programs")
    .insert({
      name_en: nameEn,
      name_ar: formString(form, "name_ar") || null,
      description_en: formString(form, "description_en") || null,
      description_ar: formString(form, "description_ar") || null,
      status: formString(form, "status") || "draft",
      created_by: user.id,
    })
    .select("id")
    .single()
  if (error || !program) return { error: error?.message ?? t("Unable to create program.") }

  const ids = form.getAll("exercise_id").map(String)
  const sets = form.getAll("sets")
  const reps = form.getAll("reps")
  if (ids.length) {
    const { error: exerciseError } = await supabase.from("program_exercises").insert(
      ids.map((id, index) => ({
        program_id: program.id,
        exercise_id: id,
        sort_order: index,
        sets: Number(sets[index]) || 1,
        reps: Number(reps[index]) || 1,
      })),
    )
    if (exerciseError) {
      await supabase.from("programs").delete().eq("id", program.id)
      return { error: exerciseError.message }
    }
  }

  revalidatePath("/admin")
  return { error: null }
}

export async function updateProgram(
  id: string,
  values: { name_en: string; name_ar?: string; description_en?: string; description_ar?: string; status: string },
) {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.ctx.supabase
    .from("programs")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}

export async function deleteProgram(id: string) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can delete programs."))
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.ctx.supabase.from("programs").delete().eq("id", id)
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}

export async function createProgramRule(form: FormData) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can add rules."))
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.ctx.supabase.from("program_rules").insert({
    name: formString(form, "name"),
    rule_type: formString(form, "rule_type"),
    condition_json: {
      attribute: formString(form, "attribute"),
      operator: formString(form, "operator"),
      value: formString(form, "value"),
    },
    action_json: {
      action: formString(form, "action"),
      original_exercise_id: formString(form, "original_exercise_id") || null,
      replacement_exercise_id: formString(form, "replacement_exercise_id") || null,
      injected_exercise_ids: form.getAll("injected_exercise_ids").map(String),
    },
    created_by: auth.ctx.user.id,
  })
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}

export async function createManualProgramRule(formData: FormData) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can add rules."))
  if (!auth.ok) return { error: auth.error }

  const ruleId = formString(formData, "rule_id")
  const metric = formString(formData, "metric")
  const operator = formString(formData, "operator")
  const threshold = formString(formData, "threshold")
  const action = formString(formData, "action").toUpperCase()
  const exerciseId = formString(formData, "exercise_id")
  if (!ruleId || !metric || !operator || !threshold || !["ADD", "REMOVE"].includes(action) || !exerciseId) {
    return { error: t("Complete every rule field.") }
  }

  const service = createAdminClient()
  const { data: program } = await service.from("programs").select("id").eq("name_en", RULES_PROGRAM_NAME).maybeSingle()
  if (!program) return { error: t("Rules engine program is missing.") }

  const { error } = await service.from("program_rules").insert({
    program_id: program.id,
    name: ruleId,
    rule_text: [ruleId, metric, operator, threshold, action, exerciseId].join("\t"),
    rule_type: "coach_ahmed_manual",
    condition_json: { metric, operator, threshold },
    action_json: { action, exercise_id: exerciseId },
    priority: 1000,
    is_active: true,
    created_by: auth.ctx.user.id,
  })
  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { error: null }
}

export async function reviewAthleteProgram(id: string, status: "approved" | "rejected") {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can review programs."))
  if (!auth.ok) return { error: auth.error }
  if (!id?.trim()) return { error: t("Missing program id") }
  if (status !== "approved" && status !== "rejected") return { error: t("Invalid status.") }

  const { data: updated, error } = await auth.ctx.supabase
    .from("athlete_programs")
    .update({ status, reviewed_by: auth.ctx.user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("athlete_id")
    .maybeSingle()
  // One live program per athlete: approving a new one archives the athlete's older approved/active ones
  // (athletes only ever saw the newest, but the review list kept showing all of them as approved).
  // Their completions and feedback stay, linked to the archived program.
  if (!error && status === "approved" && updated?.athlete_id) {
    await auth.ctx.supabase
      .from("athlete_programs")
      .update({ status: "archived" })
      .eq("athlete_id", updated.athlete_id)
      .in("status", ["approved", "active"])
      .neq("id", id)
  }
  revalidatePath("/admin")
  revalidatePath("/program")
  return { error: error?.message ?? null }
}

export async function saveGeneratedProgram(input: {
  athleteId: string
  startDate: string
  time: string
  weekdays: number[]
  sessions: unknown[]
}) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can create programs."))
  if (!auth.ok) return { error: auth.error }

  if (!input.athleteId || !input.startDate || !input.time || !input.weekdays?.length || !input.sessions?.length) {
    return { error: t("Complete the schedule before saving.") }
  }

  const start = new Date(`${input.startDate}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 27)

  const { data, error } = await auth.ctx.supabase
    .from("athlete_programs")
    .insert({
      athlete_id: input.athleteId,
      month_start: input.startDate,
      month_end: end.toISOString().slice(0, 10),
      generation_reason: {
        source: "coach_ahmed_rules_v1",
        schedule: { time: input.time, weekdays: input.weekdays },
        sessions: input.sessions,
      },
      status: "pending_review",
    })
    .select("id")
    .single()
  if (error || !data) return { error: error?.message || t("Unable to save program.") }

  revalidatePath("/admin")
  revalidatePath("/program")
  return { error: null, id: data.id }
}

export async function markNotificationRead(id: string) {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.ctx.supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", auth.ctx.user.id)
  revalidatePath("/admin")
  return { error: error?.message ?? null }
}
