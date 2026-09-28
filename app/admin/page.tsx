import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminBoard } from "@/components/admin/admin-board"
import { DashboardTopBar } from "@/components/shared/dashboard-top-bar"
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "supporting_coach"].includes(profile.role)) redirect("/dashboard")
  const service = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [{ data: teams }, { data: sessions }, { data: athletes }, { data: exercises }, { data: selfies }, { data: notifications }, { data: rules }, { data: programs }] = await Promise.all([
    supabase.from("teams").select("id, name_en, name_ar, color_hex, image_url, is_national_team").order("name_en"),
    supabase.from("session_posts").select("id, title_en, title_ar, notes, session_date, start_time, team_id, athlete_id, teams(name_en, name_ar)").order("session_date", { ascending: false }).limit(20),
    service.from("athletes").select("id, tier, account_status, assessment_status, medical_clearance_status, intake_completed_at, phone, height_cm, weight_kg, injury_notes, goals, created_at").order("created_at", { ascending: false }),
    service.from("exercises").select("id, name_en, name_ar, category, image_url, video_youtube_url, default_sets, default_reps, exercise_code, movement_pattern, difficulty").order("name_en"),
    supabase.from("session_selfies").select("id, image_url, uploaded_at, reviewed, session_athletes(athlete_id)").eq("reviewed", false).order("uploaded_at", { ascending: false }),
    supabase.from("notifications").select("id, title, body, is_read, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("program_rules").select("id, name, rule_type, condition_json, action_json, is_active, created_at").order("created_at", { ascending: false }),
    supabase.from("athlete_programs").select("id, athlete_id, status, month_start, month_end, generation_reason, athletes(profiles(full_name))").order("created_at", { ascending: false }),
  ])
  const authUsers = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
  console.log("[athlete-debug] auth users loaded", { count: authUsers.data.users.length, error: authUsers.error?.message ?? null })
  const authEmailById = new Map(authUsers.data.users.map((authUser) => [authUser.id, authUser.email ?? ""]))
  const athleteIds = (athletes ?? []).map((athlete) => athlete.id)
  const { data: athleteProfiles } = athleteIds.length ? await service.from("profiles").select("id,full_name,full_name_ar,role,subscription_tier,renewal_date,coach_private_notes").in("id", athleteIds) : { data: [], error: null }
  const athleteProfileById = new Map((athleteProfiles ?? []).map((profile) => [profile.id, profile]))
  const { data: athleteTeams } = athleteIds.length ? await service.from("athlete_teams").select("athlete_id,team_id,teams(name_en,name_ar,image_url,color_hex)").in("athlete_id", athleteIds) : { data: [] }
  const teamsByAthlete = new Map<string, any[]>([])
  for (const membership of athleteTeams ?? []) teamsByAthlete.set(membership.athlete_id, [...(teamsByAthlete.get(membership.athlete_id) ?? []), membership])
  const [{ data: measurements }, { data: inbodyRecords }, { data: assessments }] = athleteIds.length ? await Promise.all([supabase.from("measurements").select("athlete_id,height_cm,weight_kg,recorded_at").in("athlete_id", athleteIds).order("recorded_at", { ascending: false }), supabase.from("inbody_records").select("athlete_id,height_cm,weight_kg,recorded_at").in("athlete_id", athleteIds).order("recorded_at", { ascending: false }), supabase.from("athlete_assessments").select("id,athlete_id,submitted_at,status,assessment_photo_path").in("athlete_id", athleteIds).order("submitted_at", { ascending: false })]) : [{ data: [] }, { data: [] }, { data: [] }]
  const latestAssessmentIds = (assessments ?? []).filter((assessment, index, rows) => rows.findIndex((candidate) => candidate.athlete_id === assessment.athlete_id) === index).map((assessment) => assessment.id)
  const { data: assessmentAnswers } = latestAssessmentIds.length ? await service.from("athlete_assessment_answers").select("assessment_id,question_key,answer_json").in("assessment_id", latestAssessmentIds) : { data: [] }
  const enrichedAthletes = (athletes ?? []).map((athlete) => { const latestAssessment = assessments?.find((row) => row.athlete_id === athlete.id); return { ...athlete, athlete_teams: teamsByAthlete.get(athlete.id) ?? [], profiles: athleteProfileById.get(athlete.id) ?? { id: athlete.id, full_name: "Unnamed athlete", role: "athlete" }, auth_email: authEmailById.get(athlete.id) ?? "", latest_measurement: measurements?.find((row) => row.athlete_id === athlete.id), latest_inbody: inbodyRecords?.find((row) => row.athlete_id === athlete.id), latest_assessment: latestAssessment, assessment_answers: (assessmentAnswers ?? []).filter((answer) => answer.assessment_id === latestAssessment?.id) } })
  return <><DashboardTopBar /><AdminErrorBoundary><AdminBoard teams={teams ?? []} sessions={sessions ?? []} athletes={enrichedAthletes} exercises={exercises ?? []} selfies={selfies ?? []} notifications={notifications ?? []} rules={rules ?? []} programs={programs ?? []} /></AdminErrorBoundary></>
}
