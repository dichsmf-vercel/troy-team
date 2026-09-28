"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function submitAssessment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Please sign in first." }
  const injuryFlags = String(formData.get("injury_flags") || "").split(",").map((v) => v.trim()).filter(Boolean)
  const trainingDays = Number(formData.get("training_days"))
  if (formData.get("training_days") && (!Number.isInteger(trainingDays) || trainingDays < 1 || trainingDays > 7)) return { error: "Training days must be a whole number from 1 to 7." }
  const goals = String(formData.get("goals") || "").split(",").map((v) => v.trim()).filter(Boolean)
  const { data: assessment, error } = await supabase.from("athlete_assessments").insert({ athlete_id: user.id, status: "submitted", submitted_at: new Date().toISOString(), injury_flags: injuryFlags, goals }).select("id").single()
  if (error || !assessment) return { error: error?.message || "Unable to submit assessment." }
  const answers = ["training_days", "experience", "equipment", "medical_notes"].map((key) => ({ assessment_id: assessment.id, question_key: key, answer_json: { value: key === "training_days" ? trainingDays || null : key === "equipment" ? formData.getAll("equipment").map(String) : String(formData.get(key) || "").trim() } }))
  const { error: answerError } = await supabase.from("athlete_assessment_answers").insert(answers)
  if (answerError) return { error: answerError.message }
  await supabase.from("athletes").update({ assessment_status: "submitted", injury_notes: injuryFlags.join(", "), goals: goals.join(", ") }).eq("id", user.id)
  revalidatePath("/assessment")
  revalidatePath("/admin")
  return { error: null }
}

export async function uploadAssessmentPhoto(formData: FormData) { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return { error: "Please sign in first." }; const photo = formData.get("assessment_photo"); if (!(photo instanceof File) || photo.size === 0) return { error: "Choose an image first." }; if (!photo.type.startsWith("image/") || photo.size > 8 * 1024 * 1024) return { error: "Upload an image smaller than 8 MB." }; const path = `${user.id}/${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`; const { error: uploadError } = await supabase.storage.from("inbody-photos").upload(path, photo, { contentType: photo.type, upsert: false }); if (uploadError) return { error: uploadError.message }; const { data: assessment } = await supabase.from("athlete_assessments").select("id").eq("athlete_id", user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle(); if (!assessment) return { error: "Submit your assessment before uploading an image." }; const { error } = await supabase.from("athlete_assessments").update({ assessment_photo_path: path }).eq("id", assessment.id); if (error) return { error: error.message }; revalidatePath("/assessment"); revalidatePath("/admin"); return { error: null } }

export async function saveInbody(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Please sign in first." }
  const { error } = await supabase.from("inbody_records").insert({ athlete_id: user.id, weight_kg: Number(formData.get("weight_kg")) || null, height_cm: Number(formData.get("height_cm")) || null, body_fat_pct: Number(formData.get("body_fat_pct")) || null, muscle_mass_kg: Number(formData.get("muscle_mass_kg")) || null, bmi: Number(formData.get("bmi")) || null, notes: String(formData.get("notes") || "").trim() || null })
  if (error) return { error: error.message }
  revalidatePath("/assessment")
  revalidatePath("/progress")
  return { error: null }
} 

export async function generatePendingProgram(athleteId: string, assessmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }
  const start = new Date(); start.setDate(1)
  const end = new Date(start); end.setMonth(end.getMonth() + 1); end.setDate(0)
  const { data: athleteProgram, error } = await supabase.from("athlete_programs").insert({ athlete_id: athleteId, assessment_id: assessmentId, month_start: start.toISOString().slice(0, 10), month_end: end.toISOString().slice(0, 10), generation_reason: { source: "assessment", rule_engine: "baseline_v1" }, status: "pending_review" }).select("id").single()
  if (error || !athleteProgram) return { error: error?.message || "Unable to create pending program." }
  return { error: null, athleteProgramId: athleteProgram.id }
}
