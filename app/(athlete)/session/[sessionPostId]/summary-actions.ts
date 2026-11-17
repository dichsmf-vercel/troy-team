"use server"

import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/guards"
import { getOwnedSessionAthlete } from "@/lib/auth/ownership"
import { getT } from "@/lib/i18n/get-language"

const inRange = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max

export async function submitSessionSummary(
  sessionAthleteId: string,
  sessionPostId: string,
  input: {
    rpe: number
    overallRating: number
    sleepQuality: number
    sorenessLevel: number
    symptoms: string[]
    feedbackText: string
  },
) {
  const t = await getT()
  const auth = await requireUser()
  if (!auth.ok) return { error: t("Not authenticated") }
  const { supabase, user } = auth.ctx

  const owned = await getOwnedSessionAthlete(supabase, user.id, sessionAthleteId)
  if (!owned || owned.sessionPostId !== sessionPostId) return { error: t("Session not found.") }

  if (![input.rpe, input.overallRating, input.sleepQuality, input.sorenessLevel].every((value) => inRange(value, 0, 10))) {
    return { error: t("Ratings must be between 0 and 10.") }
  }

  const { error } = await supabase.from("session_summaries").upsert(
    {
      session_athlete_id: sessionAthleteId,
      rpe: input.rpe,
      overall_rating: input.overallRating,
      sleep_quality: input.sleepQuality,
      soreness_level: input.sorenessLevel,
      symptoms: (Array.isArray(input.symptoms) ? input.symptoms : []).map((symptom) => String(symptom).slice(0, 80)).slice(0, 20),
      feedback_text: String(input.feedbackText ?? "").slice(0, 2000),
    },
    { onConflict: "session_athlete_id" },
  )
  if (error) return { error: error.message }

  redirect("/dashboard")
}
