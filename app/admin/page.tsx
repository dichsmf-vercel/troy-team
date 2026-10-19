import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminBoard } from "@/components/admin/admin-board"
import { DashboardTopBar } from "@/components/shared/dashboard-top-bar"
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "supporting_coach"].includes(profile.role)) redirect("/dashboard")
  const service = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const [
    { data: teams },
    { data: sessions },
    { data: athletes },
    { data: exercises },
    { data: programSelfies },
    { data: sessionSelfies },
    { data: notifications },
    { data: rules },
    { data: programs },
  ] = await Promise.all([
    supabase.from("teams").select("id, name_en, name_ar, color_hex, image_url, is_national_team").order("name_en"),
    supabase.from("session_posts").select("id, title_en, title_ar, notes, session_date, start_time, team_id, athlete_id, teams(name_en, name_ar)").order("session_date", { ascending: false }).limit(20),
    service.from("athletes").select("id, tier, account_status, assessment_status, medical_clearance_status, intake_completed_at, phone, height_cm, weight_kg, injury_notes, goals, created_at").order("created_at", { ascending: false }),
    service.from("exercises").select("id, name_en, name_ar, category, image_url, video_youtube_url, default_sets, default_reps, exercise_code, movement_pattern, difficulty").order("name_en"),
    service.from("program_exercise_selfies").select("id, athlete_id, athlete_program_id, session_date, exercise_index, storage_path, uploaded_at").is("reviewed_at", null).order("uploaded_at", { ascending: false }),
    service.from("session_exercise_selfies").select("id, athlete_id, session_athlete_id, session_exercise_id, storage_path, uploaded_at").is("reviewed_at", null).order("uploaded_at", { ascending: false }),
    supabase.from("notifications").select("id, title, body, is_read, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("program_rules").select("id, name, rule_type, condition_json, action_json, is_active, created_at").order("created_at", { ascending: false }),
    supabase.from("athlete_programs").select("id, athlete_id, status, month_start, month_end, generation_reason, athletes(profiles(full_name))").order("created_at", { ascending: false }),
  ])

  // Signed URLs for selfies
  const programSelfiesWithLinks = await Promise.all((programSelfies ?? []).map(async (selfie: any) => {
    const { data } = await service.storage.from("exercise-selfies").createSignedUrl(selfie.storage_path, 60 * 60)
    return { ...selfie, image_url: data?.signedUrl ?? null, selfie_type: "program" as const }
  }))
  const sessionSelfiesWithLinks = await Promise.all((sessionSelfies ?? []).map(async (selfie: any) => {
    const { data } = await service.storage.from("session-selfies").createSignedUrl(selfie.storage_path, 60 * 60)
    return { ...selfie, image_url: data?.signedUrl ?? null, selfie_type: "session" as const }
  }))
  const selfiesWithLinks = [...programSelfiesWithLinks, ...sessionSelfiesWithLinks]

  // Auth emails
  const authUsers = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authEmailById = new Map(authUsers.data.users.map((u) => [u.id, u.email ?? ""]))

  // Athlete enrichment
  const athleteIds = (athletes ?? []).map((a) => a.id)
  const { data: athleteProfiles } = athleteIds.length
    ? await service.from("profiles").select("id,full_name,full_name_ar,role,subscription_tier,renewal_date,coach_private_notes").in("id", athleteIds)
    : { data: [] }
  const athleteProfileById = new Map((athleteProfiles ?? []).map((p) => [p.id, p]))
  const { data: athleteTeams } = athleteIds.length
    ? await service.from("athlete_teams").select("athlete_id,team_id,teams(name_en,name_ar,image_url,color_hex)").in("athlete_id", athleteIds)
    : { data: [] }
  const teamsByAthlete = new Map<string, any[]>()
  for (const m of athleteTeams ?? []) teamsByAthlete.set(m.athlete_id, [...(teamsByAthlete.get(m.athlete_id) ?? []), m])
  const [{ data: measurements }, { data: inbodyRecords }, { data: assessments }] = athleteIds.length
    ? await Promise.all([
        supabase.from("measurements").select("athlete_id,height_cm,weight_kg,recorded_at").in("athlete_id", athleteIds).order("recorded_at", { ascending: false }),
        supabase.from("inbody_records").select("athlete_id,height_cm,weight_kg,recorded_at").in("athlete_id", athleteIds).order("recorded_at", { ascending: false }),
        supabase.from("athlete_assessments").select("id,athlete_id,submitted_at,status,assessment_photo_path").in("athlete_id", athleteIds).order("submitted_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const latestAssessmentIds = (assessments ?? []).filter((a, i, arr) => arr.findIndex((b) => b.athlete_id === a.athlete_id) === i).map((a) => a.id)
  const { data: assessmentAnswers } = latestAssessmentIds.length
    ? await service.from("athlete_assessment_answers").select("assessment_id,question_key,answer_json").in("assessment_id", latestAssessmentIds)
    : { data: [] }
  const enrichedAthletes = (athletes ?? []).map((athlete) => {
    const latestAssessment = assessments?.find((row) => row.athlete_id === athlete.id)
    return {
      ...athlete,
      athlete_teams: teamsByAthlete.get(athlete.id) ?? [],
      profiles: athleteProfileById.get(athlete.id) ?? { id: athlete.id, full_name: "Unnamed athlete", role: "athlete" },
      auth_email: authEmailById.get(athlete.id) ?? "",
      latest_measurement: measurements?.find((row) => row.athlete_id === athlete.id),
      latest_inbody: inbodyRecords?.find((row) => row.athlete_id === athlete.id),
      latest_assessment: latestAssessment,
      assessment_answers: (assessmentAnswers ?? []).filter((a) => a.assessment_id === latestAssessment?.id),
    }
  })

  // ── Feedback: session summaries + pain reports ────────────────────────────────
  const sessionAthleteRows = athleteIds.length
    ? (await service.from("session_athletes").select("id,athlete_id,session_post_id").in("athlete_id", athleteIds)).data ?? []
    : []
  const saIdList = sessionAthleteRows.map((row: any) => row.id)
  const [{ data: rawSummaries }, { data: rawPainRows }] = saIdList.length
    ? await Promise.all([
        service.from("session_summaries").select("id,session_athlete_id,rpe,overall_rating,sleep_quality,soreness_level,symptoms,feedback_text,submitted_at").in("session_athlete_id", saIdList).order("submitted_at", { ascending: false }).limit(200),
        service.from("exercise_completions").select("id,session_athlete_id,session_exercise_id,pain_location,pain_severity,pain_notes,created_at").eq("pain_reported", true).in("session_athlete_id", saIdList).order("created_at", { ascending: false }).limit(200),
      ])
    : [{ data: [] }, { data: [] }]

  const saMap = new Map(sessionAthleteRows.map((row: any) => [row.id, row]))
  const spIds = [...new Set(sessionAthleteRows.map((row: any) => row.session_post_id).filter(Boolean))]
  const { data: spRows } = spIds.length
    ? await service.from("session_posts").select("id,title_en,session_date").in("id", spIds)
    : { data: [] }
  const spMap = new Map((spRows ?? []).map((sp: any) => [sp.id, sp]))
  const seIds = [...new Set((rawPainRows ?? []).map((row: any) => row.session_exercise_id).filter(Boolean))]
  const { data: seRows } = seIds.length
    ? await service.from("session_exercises").select("id,exercises(name_en)").in("id", seIds)
    : { data: [] }
  const seMap = new Map((seRows ?? []).map((se: any) => [se.id, se]))

  const feedbackSummaries = (rawSummaries ?? []).map((row: any) => {
    const sa = saMap.get(row.session_athlete_id) as any
    const sp = sa ? spMap.get(sa.session_post_id) as any : null
    return { id: row.id, athlete_id: sa?.athlete_id ?? "", session_post_id: sa?.session_post_id ?? "", session_title: sp?.title_en ?? "Training session", session_date: sp?.session_date ?? "", submitted_at: row.submitted_at, rpe: row.rpe, overall_rating: row.overall_rating, sleep_quality: row.sleep_quality, soreness_level: row.soreness_level, symptoms: row.symptoms, feedback_text: row.feedback_text }
  }).filter((row: any) => row.athlete_id)

  const feedbackPainReports = (rawPainRows ?? []).map((row: any) => {
    const sa = saMap.get(row.session_athlete_id) as any
    const sp = sa ? spMap.get(sa.session_post_id) as any : null
    const se = seMap.get(row.session_exercise_id) as any
    const exName = Array.isArray(se?.exercises) ? se.exercises[0]?.name_en : se?.exercises?.name_en
    return { id: row.id, athlete_id: sa?.athlete_id ?? "", session_post_id: sa?.session_post_id ?? "", session_title: sp?.title_en ?? "Training session", session_date: sp?.session_date ?? "", exercise_name: exName ?? "Exercise", pain_location: row.pain_location, pain_severity: row.pain_severity, pain_notes: row.pain_notes, reported_at: row.created_at }
  }).filter((row: any) => row.athlete_id)

  return (
    <>
      <DashboardTopBar />
      <AdminErrorBoundary>
        <AdminBoard
          teams={teams ?? []}
          sessions={sessions ?? []}
          athletes={enrichedAthletes}
          exercises={exercises ?? []}
          selfies={selfiesWithLinks}
          notifications={notifications ?? []}
          rules={rules ?? []}
          programs={programs ?? []}
          feedbackSummaries={feedbackSummaries}
          feedbackPainReports={feedbackPainReports}
        />
      </AdminErrorBoundary>
    </>
  )
}
