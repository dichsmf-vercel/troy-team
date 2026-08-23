import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProgressDashboard } from "@/components/progress/progress-dashboard"

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect("/auth/login")

  const athleteId = userData.user.id

  const { data: measurements } = await supabase
    .from("measurements")
    .select("recorded_at, weight_kg, body_fat_pct")
    .eq("athlete_id", athleteId)
    .order("recorded_at", { ascending: true })

  const { data: sessionAthletes } = await supabase
    .from("session_athletes")
    .select("id, attended_at, session_post_id, session_posts(session_date)")
    .eq("athlete_id", athleteId)

  const attendedSessions = (sessionAthletes ?? []).filter((sa) => sa.attended_at)
  const sessionAthleteIds = attendedSessions.map((sa) => sa.id)

  let summaries: { rpe: number | null; submitted_at: string }[] = []
  if (sessionAthleteIds.length > 0) {
    const { data } = await supabase
      .from("session_summaries")
      .select("rpe, submitted_at")
      .in("session_athlete_id", sessionAthleteIds)
    summaries = data ?? []
  }

  const totalAssigned = sessionAthletes?.length ?? 0
  const totalAttended = attendedSessions.length
  const attendanceRate = totalAssigned > 0 ? Math.round((totalAttended / totalAssigned) * 100) : 0
  const avgRpe =
    summaries.length > 0
      ? Math.round((summaries.reduce((sum, s) => sum + (s.rpe ?? 0), 0) / summaries.length) * 10) / 10
      : null

  return (
    <ProgressDashboard
      measurements={(measurements ?? []).map((m) => ({
        date: m.recorded_at,
        weight: m.weight_kg ? Number(m.weight_kg) : null,
        bodyFat: m.body_fat_pct ? Number(m.body_fat_pct) : null,
      }))}
      rpeHistory={summaries.map((s) => ({ date: s.submitted_at, rpe: s.rpe ?? 0 }))}
      attendanceRate={attendanceRate}
      totalAttended={totalAttended}
      avgRpe={avgRpe}
    />
  )
}
