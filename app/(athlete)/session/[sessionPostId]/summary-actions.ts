"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

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
  const supabase = await createClient()
  const { error } = await supabase.from("session_summaries").upsert(
    {
      session_athlete_id: sessionAthleteId,
      rpe: input.rpe,
      overall_rating: input.overallRating,
      sleep_quality: input.sleepQuality,
      soreness_level: input.sorenessLevel,
      symptoms: input.symptoms,
      feedback_text: input.feedbackText,
    },
    { onConflict: "session_athlete_id" },
  )
  if (error) return { error: error.message }

  redirect("/dashboard")
}
