import { redirect } from "next/navigation"
import { firstRelation } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { ProgressDashboard } from "@/components/progress/progress-dashboard"
import { logPageHealth } from "@/lib/formatters"
import { getT } from "@/lib/i18n/get-language"
import { loadAthleteActivity } from "@/lib/athlete-activity"

export default async function ProgressPage() {
  const t = await getT()
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect("/auth/login")
  const athleteId = userData.user.id

  const [{ data: measurements, error: measurementsError }, { data: assessments, error: assessmentError }, { data: athletePrograms, error: programError }, activity] = await Promise.all([
    supabase.from("measurements").select("recorded_at, weight_kg, body_fat_pct").eq("athlete_id", athleteId).order("recorded_at", { ascending: true }),
    supabase.from("athlete_assessments").select("status, updated_at").eq("athlete_id", athleteId).order("updated_at", { ascending: false }).limit(1),
    supabase.from("athlete_programs").select("status, programs(name_en)").eq("athlete_id", athleteId).in("status", ["approved", "active"]).order("month_start", { ascending: false }).limit(1),
    // Assigned sessions AND monthly-program sessions (program sessions were ignored before: attendance showed 0/0).
    loadAthleteActivity(supabase, athleteId, { programSession: t("Program session"), trainingSession: t("Training session") }),
  ])

  // Older intake saves logged the same measurement several times on one day: show each value once per day.
  const measurementRows = (measurements ?? []).filter((row, index, all) => {
    const previous = all[index - 1]
    return !previous || previous.recorded_at?.slice(0, 10) !== row.recorded_at?.slice(0, 10) || Number(previous.weight_kg) !== Number(row.weight_kg) || Number(previous.body_fat_pct) !== Number(row.body_fat_pct)
  })

  const totalAssigned = activity.attendance.length
  const totalAttended = activity.attendance.filter((entry) => entry.status === "present").length
  const rpes = activity.rpe.map((entry) => entry.rpe)
  const assessmentStatus = assessments?.[0]?.status ?? "not_started"
  const program = athletePrograms?.[0]
  logPageHealth("athlete-progress", { athleteId, measurements: measurementRows.length, sessions: totalAssigned, summaries: rpes.length, queryErrors: [measurementsError, assessmentError, programError].filter(Boolean).map((error) => error?.message) })

  return (
    <ProgressDashboard
      measurements={measurementRows.map((m) => ({ date: m.recorded_at, weight: m.weight_kg == null ? null : Number(m.weight_kg), bodyFat: m.body_fat_pct == null ? null : Number(m.body_fat_pct) }))}
      rpeHistory={activity.rpe.map((entry) => ({ date: entry.date, rpe: entry.rpe }))}
      attendance={activity.attendance.map((entry) => ({ date: entry.date, status: entry.status, title: entry.title }))}
      attendanceRate={totalAssigned ? Math.round((totalAttended / totalAssigned) * 100) : 0}
      totalAssigned={totalAssigned}
      totalAttended={totalAttended}
      avgRpe={rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null}
      assessmentStatus={assessmentStatus}
      activeProgram={program ? { name: firstRelation(program.programs)?.name_en ?? t("Training program"), status: program.status } : null}
    />
  )
}
