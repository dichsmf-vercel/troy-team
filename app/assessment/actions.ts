"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth/guards"
import { formNumber, formString } from "@/lib/admin/forms"
import { getT } from "@/lib/i18n/get-language"

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean)

export async function submitAssessment(formData: FormData) {
  const t = await getT()
  const auth = await requireUser()
  if (!auth.ok) return { error: t("Please sign in first.") }
  const { supabase, user } = auth.ctx

  const injuryFlags = splitList(formString(formData, "injury_flags"))
  const goals = splitList(formString(formData, "goals"))

  const { data: assessment, error } = await supabase
    .from("athlete_assessments")
    .insert({ athlete_id: user.id, status: "submitted", submitted_at: new Date().toISOString(), injury_flags: injuryFlags, goals })
    .select("id")
    .single()
  if (error || !assessment) return { error: error?.message || t("Unable to submit assessment.") }

  // `training_days` is not collected by the form yet; it is stored as null so readers keep working.
  const answers = ["training_days", "experience", "equipment", "medical_notes"].map((key) => ({
    assessment_id: assessment.id,
    question_key: key,
    answer_json: {
      value: key === "training_days" ? null : key === "equipment" ? formData.getAll("equipment").map(String) : formString(formData, key),
    },
  }))
  const { error: answerError } = await supabase.from("athlete_assessment_answers").insert(answers)
  if (answerError) return { error: answerError.message }

  await supabase
    .from("athletes")
    .update({ assessment_status: "submitted", injury_notes: injuryFlags.join(", "), goals: goals.join(", ") })
    .eq("id", user.id)

  revalidatePath("/assessment")
  revalidatePath("/admin")
  return { error: null }
}

export async function uploadAssessmentPhoto(formData: FormData) {
  const t = await getT()
  const auth = await requireUser()
  if (!auth.ok) return { error: t("Please sign in first.") }
  const { supabase, user } = auth.ctx

  const photo = formData.get("assessment_photo")
  if (!(photo instanceof File) || photo.size === 0) return { error: t("Choose an image first.") }
  if (!photo.type.startsWith("image/") || photo.size > MAX_PHOTO_BYTES) return { error: t("Upload an image smaller than 8 MB.") }

  const { data: assessment } = await supabase
    .from("athlete_assessments")
    .select("id")
    .eq("athlete_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!assessment) return { error: t("Submit your assessment before uploading an image.") }

  const path = `${user.id}/${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const { error: uploadError } = await supabase.storage.from("inbody-photos").upload(path, photo, { contentType: photo.type, upsert: false })
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from("athlete_assessments").update({ assessment_photo_path: path }).eq("id", assessment.id)
  if (error) {
    await supabase.storage.from("inbody-photos").remove([path])
    return { error: error.message }
  }

  revalidatePath("/assessment")
  revalidatePath("/admin")
  return { error: null }
}

export async function saveInbody(formData: FormData) {
  const t = await getT()
  const auth = await requireUser()
  if (!auth.ok) return { error: t("Please sign in first.") }
  const { supabase, user } = auth.ctx

  const { error } = await supabase.from("inbody_records").insert({
    athlete_id: user.id,
    weight_kg: formNumber(formData, "weight_kg"),
    height_cm: formNumber(formData, "height_cm"),
    body_fat_pct: formNumber(formData, "body_fat_pct"),
    muscle_mass_kg: formNumber(formData, "muscle_mass_kg"),
    bmi: formNumber(formData, "bmi"),
    notes: formString(formData, "notes") || null,
  })
  if (error) return { error: error.message }

  revalidatePath("/assessment")
  revalidatePath("/progress")
  return { error: null }
}
