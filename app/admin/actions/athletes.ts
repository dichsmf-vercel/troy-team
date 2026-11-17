"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, requireStaff } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAthleteAuthUser, deleteAthleteCompletely, generateTemporaryPassword } from "@/lib/admin/athlete-accounts"
import { formDays, formNumber, formString } from "@/lib/admin/forms"
import { getT } from "@/lib/i18n/get-language"
import { getSiteUrl } from "@/lib/site-url"

const FMS_KEYS = [
  "deep_squat",
  "hurdle_step",
  "inline_lunge",
  "shoulder_mobility",
  "active_straight_leg_raise",
  "trunk_stability",
  "rotary_stability",
] as const

const ASSESSMENT_FIELDS = [
  "body_fat_pct", "bmi", ...FMS_KEYS, "fms_total", "v_jump_cm", "sprint_30m_seconds", "t_test_seconds",
  "beep_test_level", "beep_test_speed", "beep_test_vo2_max", "star_balance", "agility_rshaqah_seconds",
  "squat_1rm_kg", "bench_press_1rm_kg", "deadlift_1rm_kg", "power_clean_1rm_kg", "shoulder_press_1rm_kg",
] as const

const NO_PROGRAM_GOAL = "Assigned exercises only (No monthly program assigned)"

export async function createAthleteAccount(form: FormData) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can create athletes."))
  if (!auth.ok) return { error: auth.error }

  const fullName = formString(form, "full_name")
  if (!fullName) return { error: t("Full name is required.") }

  const service = createAdminClient()
  const created = await createAthleteAuthUser(service, fullName)
  if (!created.ok) return { error: created.error }
  const { id, troyId, temporaryPassword } = created

  // Anything that fails from here on removes the half-created athlete again.
  const fail = async (message: string) => {
    await deleteAthleteCompletely(service, id)
    return { error: message }
  }

  const { error: profileError } = await service.from("profiles").upsert({
    id,
    full_name: fullName,
    full_name_ar: formString(form, "full_name_ar") || null,
    role: "athlete",
    troy_id: troyId,
    password_change_required: true,
  })
  if (profileError) return fail(profileError.message)

  const height = formNumber(form, "height_cm")
  const weight = formNumber(form, "weight_kg")
  const hasProgram = form.get("has_program") !== "false"

  const { error: athleteError } = await service.from("athletes").upsert({
    id,
    phone: formString(form, "phone") || null,
    height_cm: height,
    weight_kg: weight,
    injury_notes: formString(form, "coach_notes") || null,
    assessment_status: "draft",
    sport: formString(form, "sport") || null,
    position: formString(form, "position") || null,
    birth_year: formNumber(form, "birth_year"),
    free_training_days: formDays(form, "free_training_days"),
    show_exercise_recap: form.get("show_exercise_recap") !== "false",
    goals: hasProgram ? formString(form, "goals") || "Standard Program" : NO_PROGRAM_GOAL,
  })
  if (athleteError) return fail(athleteError.message)

  const teamId = formString(form, "team_id")
  if (teamId) {
    const { error } = await service.from("athlete_teams").insert({ athlete_id: id, team_id: teamId })
    if (error) return fail(t("Team assignment failed: {message}", { message: error.message }))
  }

  const bmi = height && weight ? Number((weight / (height / 100) ** 2).toFixed(2)) : null
  const { data: assessment, error: assessmentError } = await service
    .from("athlete_assessments")
    .insert({
      athlete_id: id,
      status: "draft",
      version: 1,
      coach_notes: formString(form, "coach_notes") || null,
      injury_flags: [],
      goals: [],
    })
    .select("id")
    .single()
  if (assessmentError || !assessment) return fail(assessmentError?.message ?? t("Assessment save failed."))

  const fmsTotal = FMS_KEYS.reduce((total, key) => total + (formNumber(form, key) ?? 0), 0)
  const answers = ASSESSMENT_FIELDS.map((key) => ({
    assessment_id: assessment.id,
    question_key: key,
    answer_json: { value: key === "bmi" ? bmi : key === "fms_total" ? fmsTotal : form.get(key) ? Number(form.get(key)) : null },
  }))
  const { error: answersError } = await service.from("athlete_assessment_answers").insert(answers)
  if (answersError) return fail(t("Assessment answers save failed: {message}", { message: answersError.message }))

  if (height || weight) {
    const { error } = await service.from("measurements").insert({
      athlete_id: id,
      recorded_at: new Date().toISOString(),
      height_cm: height,
      weight_kg: weight,
      body_fat_pct: formNumber(form, "body_fat_pct"),
      notes: "Admin assessment creation",
    })
    if (error) return fail(t("Measurement save failed: {message}", { message: error.message }))
  }
  if (height || weight || bmi) {
    const { error } = await service.from("inbody_records").insert({
      athlete_id: id,
      assessment_id: assessment.id,
      height_cm: height,
      weight_kg: weight,
      bmi,
      body_fat_pct: formNumber(form, "body_fat_pct"),
      recorded_at: new Date().toISOString(),
    })
    if (error) return fail(t("InBody save failed: {message}", { message: error.message }))
  }

  revalidatePath("/admin")
  return { error: null, athleteId: id, troyId, temporaryPassword }
}

export type AthleteAccountValues = {
  full_name: string
  phone: string
  height_cm: number | null
  weight_kg: number | null
  tier: string
  subscription_tier: string
  renewal_date: string | null
  team_id: string | null
  private_notes: string
}

export async function updateAthleteAccount(id: string, values: AthleteAccountValues) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can edit athletes."))
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth.ctx

  const { error: athleteError } = await supabase
    .from("athletes")
    .update({ tier: values.tier, phone: values.phone || null, height_cm: values.height_cm, weight_kg: values.weight_kg })
    .eq("id", id)
  if (athleteError) return { error: athleteError.message }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: values.full_name,
      subscription_tier: values.subscription_tier,
      renewal_date: values.renewal_date || null,
      coach_private_notes: values.private_notes,
    })
    .eq("id", id)
  if (profileError) return { error: profileError.message }

  await supabase.from("athlete_teams").delete().eq("athlete_id", id)
  if (values.team_id) {
    const { error } = await supabase.from("athlete_teams").insert({ athlete_id: id, team_id: values.team_id })
    if (error) return { error: error.message }
  }

  revalidatePath("/admin")
  return { error: null }
}

export async function updateAthleteAccountFromForm(form: FormData) {
  return updateAthleteAccount(formString(form, "athlete_id"), {
    full_name: formString(form, "full_name"),
    phone: formString(form, "phone"),
    height_cm: formNumber(form, "height_cm"),
    weight_kg: formNumber(form, "weight_kg"),
    tier: formString(form, "tier") || "standard",
    subscription_tier: formString(form, "subscription_tier") || "free",
    renewal_date: formString(form, "renewal_date") || null,
    team_id: formString(form, "team_id") || null,
    private_notes: String(form.get("private_notes") ?? ""),
  })
}

export async function updateAthleteSettings(form: FormData) {
  const t = await getT()
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }

  const athleteId = formString(form, "athlete_id")
  if (!athleteId) return { error: t("Missing athlete ID.") }

  const birthYear = Number(form.get("birth_year"))
  const hasProgram = form.get("has_program") === "true"

  const { error } = await createAdminClient()
    .from("athletes")
    .update({
      free_training_days: formDays(form, "free_training_days"),
      show_exercise_recap: form.get("show_exercise_recap") === "true",
      sport: formString(form, "sport") || null,
      position: formString(form, "position") || null,
      birth_year: Number.isInteger(birthYear) && birthYear > 1900 ? birthYear : null,
      goals: hasProgram ? "Standard Program" : NO_PROGRAM_GOAL,
    })
    .eq("id", athleteId)
  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { error: null }
}

export async function toggleAthleteAccountStatus(athleteId: string, status: "active" | "paused") {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can pause athlete accounts."))
  if (!auth.ok) return { error: auth.error }
  if (status !== "active" && status !== "paused") return { error: t("Invalid status.") }

  const service = createAdminClient()
  const { error } = await service.from("athletes").update({ account_status: status }).eq("id", athleteId)
  if (error) return { error: error.message }

  const { error: authError } = await service.auth.admin.updateUserById(athleteId, {
    ban_duration: status === "paused" ? "876000h" : "none",
  })
  if (authError) return { error: authError.message }

  revalidatePath("/admin")
  return { error: null }
}

export async function generateTemporaryAthletePassword(athleteId: string) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can reset athlete passwords."))
  if (!auth.ok) return { error: auth.error }

  const service = createAdminClient()
  const temporaryPassword = generateTemporaryPassword()
  const { error } = await service.auth.admin.updateUserById(athleteId, { password: temporaryPassword, email_confirm: true })
  if (error) return { error: error.message }

  // Force the athlete to choose a new password on next login.
  await service.from("profiles").update({ password_change_required: true }).eq("id", athleteId)
  return { error: null, temporaryPassword }
}

export async function sendAthleteInvitation(athleteId: string) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can send invitations."))
  if (!auth.ok) return { error: auth.error }

  const siteUrl = getSiteUrl()
  if (!siteUrl) {
    return { error: t("Site URL is not configured. Set NEXT_PUBLIC_SITE_URL to your production URL in Vercel and redeploy.") }
  }

  const service = createAdminClient()
  const { data: athleteUser } = await service.auth.admin.getUserById(athleteId)
  const email = athleteUser.user?.email
  if (!email) return { error: t("Athlete email not found.") }

  const { error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { role: "athlete" },
    redirectTo: `${siteUrl}/auth/callback?next=/auth/set-password`,
  })
  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { error: null }
}

export async function permanentlyDeleteAthlete(athleteId: string) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can permanently delete athletes."))
  if (!auth.ok) return { error: auth.error }
  if (!athleteId || athleteId === auth.ctx.user.id) return { error: t("Invalid athlete.") }

  const service = createAdminClient()
  const { data: target } = await service.from("profiles").select("role").eq("id", athleteId).maybeSingle()
  if (!target || target.role !== "athlete") return { error: t("Only athlete accounts can be deleted here.") }

  const result = await deleteAthleteCompletely(service, athleteId)
  if (result.error) return { error: result.error }

  revalidatePath("/admin")
  return { error: null }
}
