import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProgressDashboard } from "@/components/progress/progress-dashboard"
import { logPageHealth } from "@/lib/formatters"

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect("/auth/login")
  const athleteId = userData.user.id
  const [{ data: measurements, error: measurementsError }, { data: sessionAthletes, error: attendanceError }, { data: assessments, error: assessmentError }, { data: athletePrograms, error: programError }] = await Promise.all([
    supabase.from("measurements").select("recorded_at, weight_kg, body_fat_pct").eq("athlete_id", athleteId).order("recorded_at", { ascending: true }),
    supabase.from("session_athletes").select("id, status, attended_at, session_post_id, session_posts(title_en, session_date)").eq("athlete_id", athleteId).order("created_at", { ascending: true }),
    supabase.from("athlete_assessments").select("status, updated_at").eq("athlete_id", athleteId).order("updated_at", { ascending: false }).limit(1),
    supabase.from("athlete_programs").select("status, programs(name_en)").eq("athlete_id", athleteId).in("status", ["approved", "active"]).order("month_start", { ascending: false }).limit(1),
  ])
  const rows = sessionAthletes ?? []
  const sessionIds = rows.map((row: any) => row.id).filter(Boolean)
  const { data: summaries, error: summariesError } = sessionIds.length ? await supabase.from("session_summaries").select("rpe, submitted_at").in("session_athlete_id", sessionIds) : { data: [], error: null }
  const attended = rows.filter((row: any) => row.status === "present" || row.attended_at)
  const totalAssigned = rows.length
  const totalAttended = attended.length
  const rpes = (summaries ?? []).map((row: any) => Number(row.rpe)).filter(Number.isFinite)
  const assessmentStatus = assessments?.[0]?.status ?? "not_started"
  const program = athletePrograms?.[0] as any
  logPageHealth("athlete-progress", { athleteId, measurements: measurements?.length ?? 0, sessions: rows.length, summaries: summaries?.length ?? 0, queryErrors: [measurementsError, attendanceError, assessmentError, programError, summariesError].filter(Boolean).map((error: any) => error.message) })
  return <ProgressDashboard measurements={(measurements ?? []).map((m: any) => ({ date: m.recorded_at, weight: m.weight_kg == null ? null : Number(m.weight_kg), bodyFat: m.body_fat_pct == null ? null : Number(m.body_fat_pct) }))} rpeHistory={(summaries ?? []).map((s: any) => ({ date: s.submitted_at, rpe: Number(s.rpe) || 0 }))} attendance={rows.map((row: any) => ({ date: row.session_posts?.session_date ?? row.attended_at, status: row.status ?? (row.attended_at ? "present" : "absent"), title: row.session_posts?.title_en ?? "Training session" }))} attendanceRate={totalAssigned ? Math.round((totalAttended / totalAssigned) * 100) : 0} totalAssigned={totalAssigned} totalAttended={totalAttended} avgRpe={rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null} assessmentStatus={assessmentStatus} activeProgram={program ? { name: program.programs?.name_en ?? "Training program", status: program.status } : null} />
}
