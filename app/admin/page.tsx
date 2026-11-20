import { redirect } from "next/navigation"
import type { AdminAthlete, AdminAthleteProfile } from "@/lib/admin/types"
import { selectInChunks } from "@/lib/supabase/batch"
import { exerciseCodeForName, findLibraryEntry } from "@/lib/exercise-media"
import { createClient } from "@/lib/supabase/server"
import { AdminBoard } from "@/components/admin/admin-board"
import { DashboardTopBar } from "@/components/shared/dashboard-top-bar"
import { GuidedTour } from "@/components/shared/guided-tour"
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary"
import { getT } from "@/lib/i18n/get-language"
import { createAdminClient } from "@/lib/supabase/admin"

// AI program generation runs as a server action hosted by this page; allow it the full minute.
export const maxDuration = 120

type ProgramFeedbackRow = { id: string; athlete_id: string; session_date: string; difficulty: number | null; enjoyment: number | null; pain_notes: string | null; created_at: string | null }
type SessionAthleteRow = { id: string; athlete_id: string; session_post_id: string | null }
type SummaryRow = { id: string; session_athlete_id: string; rpe: number | null; overall_rating: number | null; sleep_quality: number | null; soreness_level: number | null; symptoms: string[] | null; feedback_text: string | null; submitted_at: string }
type PainRow = { id: string; session_athlete_id: string; session_exercise_id: string | null; pain_location: string | null; pain_severity: number | null; pain_notes: string | null; created_at: string }
type SessionPostRow = { id: string; title_en: string | null; session_date: string | null }
type ExerciseName = { name_en?: string | null }
type SessionExerciseRow = { id: string; exercises: ExerciseName | ExerciseName[] | null }

export default async function AdminPage() {
  const t = await getT()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "supporting_coach"].includes(profile.role)) redirect("/dashboard")
  const service = createAdminClient()

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
    service.from("athletes").select("id, tier, account_status, assessment_status, medical_clearance_status, intake_completed_at, phone, height_cm, weight_kg, injury_notes, goals, created_at, sport, position, birth_year, free_training_days, show_exercise_recap").order("created_at", { ascending: false }),
    service.from("exercises").select("id, name_en, name_ar, category, image_url, video_youtube_url, default_sets, default_reps, exercise_code, movement_pattern, difficulty").order("name_en"),
    service.from("program_exercise_selfies").select("id, athlete_id, athlete_program_id, session_date, exercise_index, storage_path, uploaded_at").is("reviewed_at", null).order("uploaded_at", { ascending: false }),
    service.from("session_exercise_selfies").select("id, athlete_id, session_athlete_id, session_exercise_id, storage_path, uploaded_at").is("reviewed_at", null).order("uploaded_at", { ascending: false }),
    supabase.from("notifications").select("id, title, body, is_read, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("program_rules").select("id, name, rule_type, condition_json, action_json, is_active, created_at").order("created_at", { ascending: false }),
    supabase.from("athlete_programs").select("id, athlete_id, status, month_start, month_end, generation_reason, athletes(profiles(full_name))").order("created_at", { ascending: false }),
  ])

  // Coach Ahmed's rules use codes E001…; catalogue rows have no exercise_code yet, so fill it from his CSV by name.
  // Same for the Arabic name: use the built-in translation when the row only has English.
  const catalogExercises = (exercises ?? []).map((exercise) => {
    const entry = findLibraryEntry({ code: exercise.exercise_code, name: exercise.name_en })
    const nameAr = exercise.name_ar && exercise.name_ar !== exercise.name_en ? exercise.name_ar : entry?.nameAr ?? exercise.name_ar
    return { ...exercise, exercise_code: exercise.exercise_code || exerciseCodeForName(exercise.name_en), name_ar: nameAr }
  })

  // Signed URLs for selfies — batched to avoid N+1 per-selfie round trips
  const programPaths = (programSelfies ?? []).map((s: { storage_path: string }) => s.storage_path)
  const sessionPaths = (sessionSelfies ?? []).map((s: { storage_path: string }) => s.storage_path)

  const [programSignedResults, sessionSignedResults] = await Promise.all([
    programPaths.length
      ? service.storage.from("exercise-selfies").createSignedUrls(programPaths, 60 * 60)
      : Promise.resolve({ data: [] }),
    sessionPaths.length
      ? service.storage.from("session-selfies").createSignedUrls(sessionPaths, 60 * 60)
      : Promise.resolve({ data: [] }),
  ])

  const programUrlByPath = new Map(
    (programSignedResults.data ?? []).map((r: { path: string | null; signedUrl: string | null }) => [r.path, r.signedUrl ?? null])
  )
  const sessionUrlByPath = new Map(
    (sessionSignedResults.data ?? []).map((r: { path: string | null; signedUrl: string | null }) => [r.path, r.signedUrl ?? null])
  )

  const programSelfiesWithLinks = (programSelfies ?? []).map((selfie: { id: string; athlete_id: string; storage_path: string; uploaded_at: string }) => ({
    ...selfie,
    image_url: programUrlByPath.get(selfie.storage_path) ?? null,
    selfie_type: "program" as const,
  }))
  const sessionSelfiesWithLinks = (sessionSelfies ?? []).map((selfie: { id: string; athlete_id: string; storage_path: string; uploaded_at: string }) => ({
    ...selfie,
    image_url: sessionUrlByPath.get(selfie.storage_path) ?? null,
    selfie_type: "session" as const,
  }))
  const selfiesWithLinks = [...programSelfiesWithLinks, ...sessionSelfiesWithLinks]

  // Auth emails
  const authEmailById = new Map<string, string>()
  for (let page = 1; page <= 20; page++) {
    const { data: authPage } = await service.auth.admin.listUsers({ page, perPage: 1000 })
    for (const u of authPage?.users ?? []) authEmailById.set(u.id, u.email ?? "")
    if ((authPage?.users?.length ?? 0) < 1000) break
  }

  // Athlete enrichment
  // All id lists below are chunked: one .in() with hundreds of UUIDs breaks the request URL.
  const allAthleteIds = (athletes ?? []).map((a) => a.id)
  // New toggle columns (migration 202611200001); ignored if the migration has not run yet.
  const { data: toggleRows } = await service.from("athletes").select("id, selfie_required, show_upcoming_exercises")
  const togglesById = new Map(((toggleRows ?? []) as { id: string; selfie_required: boolean | null; show_upcoming_exercises: boolean | null }[]).map((row) => [row.id, row]))
  const { data: athleteProfiles } = await selectInChunks<AdminAthleteProfile>(allAthleteIds, (ids) =>
    service.from("profiles").select("id,full_name,full_name_ar,role,subscription_tier,renewal_date,coach_private_notes,troy_id,password_change_required").in("id", ids))
  const athleteProfileById = new Map(athleteProfiles.map((p) => [p.id, p]))
  // Staff accounts (e.g. the admin) can have an athletes row; they are not athletes.
  const athleteIds = allAthleteIds.filter((id) => {
    const role = athleteProfileById.get(id)?.role
    return !role || role === "athlete"
  })
  const { data: athleteTeams } = await selectInChunks<NonNullable<AdminAthlete["athlete_teams"]>[number] & { athlete_id: string }>(athleteIds, (ids) =>
    service.from("athlete_teams").select("athlete_id,team_id,teams(id,name_en,name_ar,image_url,color_hex)").in("athlete_id", ids))
  const teamsByAthlete = new Map<string, NonNullable<AdminAthlete["athlete_teams"]>>()
  for (const m of athleteTeams ?? []) teamsByAthlete.set(m.athlete_id, [...(teamsByAthlete.get(m.athlete_id) ?? []), m])
  type MeasureRow = { athlete_id: string; height_cm: number | null; weight_kg: number | null; recorded_at: string | null }
  type AssessmentRow = { id: string; athlete_id: string; submitted_at: string | null; status: string | null; assessment_photo_path: string | null }
  const [{ data: measurements }, { data: inbodyRecords }, { data: assessments }] = await Promise.all([
    selectInChunks<MeasureRow>(athleteIds, (ids) => supabase.from("measurements").select("athlete_id,height_cm,weight_kg,recorded_at").in("athlete_id", ids).order("recorded_at", { ascending: false })),
    selectInChunks<MeasureRow>(athleteIds, (ids) => supabase.from("inbody_records").select("athlete_id,height_cm,weight_kg,recorded_at").in("athlete_id", ids).order("recorded_at", { ascending: false })),
    selectInChunks<AssessmentRow>(athleteIds, (ids) => supabase.from("athlete_assessments").select("id,athlete_id,submitted_at,status,assessment_photo_path").in("athlete_id", ids).order("submitted_at", { ascending: false })),
  ])
  const latestAssessmentIds = (assessments ?? []).filter((a, i, arr) => arr.findIndex((b) => b.athlete_id === a.athlete_id) === i).map((a) => a.id)
  const { data: assessmentAnswers } = await selectInChunks<{ assessment_id: string; question_key: string; answer_json: { value?: number | string | null } | null }>(latestAssessmentIds, (ids) =>
    service.from("athlete_assessment_answers").select("assessment_id,question_key,answer_json").in("assessment_id", ids))
  const athleteIdSet = new Set(athleteIds)
  const enrichedAthletes = (athletes ?? []).filter((athlete) => athleteIdSet.has(athlete.id)).map((rawAthlete) => {
    const athlete = { ...rawAthlete, selfie_required: togglesById.get(rawAthlete.id)?.selfie_required ?? false, show_upcoming_exercises: togglesById.get(rawAthlete.id)?.show_upcoming_exercises ?? false }
    const latestAssessment = assessments?.find((row) => row.athlete_id === athlete.id)
    return {
      ...athlete,
      athlete_teams: teamsByAthlete.get(athlete.id) ?? [],
      profiles: athleteProfileById.get(athlete.id) ?? { id: athlete.id, full_name: t("Unnamed athlete"), role: "athlete" },
      auth_email: authEmailById.get(athlete.id) ?? "",
      latest_measurement: measurements?.find((row) => row.athlete_id === athlete.id),
      latest_inbody: inbodyRecords?.find((row) => row.athlete_id === athlete.id),
      latest_assessment: latestAssessment,
      assessment_answers: (assessmentAnswers ?? []).filter((a) => a.assessment_id === latestAssessment?.id),
    }
  })

  // ── Feedback: session summaries + pain reports ────────────────────────────────
  const sessionAthleteRows: SessionAthleteRow[] = (await selectInChunks<SessionAthleteRow>(athleteIds, (ids) =>
    service.from("session_athletes").select("id,athlete_id,session_post_id").in("athlete_id", ids))).data
  const saIdList = sessionAthleteRows.map((row) => row.id)
  const [{ data: rawSummaries }, { data: rawPainRows }, { data: programFeedbackRows }] = await Promise.all([
    selectInChunks<SummaryRow>(saIdList, (ids) => service.from("session_summaries").select("id,session_athlete_id,rpe,overall_rating,sleep_quality,soreness_level,symptoms,feedback_text,submitted_at").in("session_athlete_id", ids).order("submitted_at", { ascending: false }).limit(200)),
    selectInChunks<PainRow>(saIdList, (ids) => service.from("exercise_completions").select("id,session_athlete_id,session_exercise_id,pain_location,pain_severity,pain_notes,created_at").eq("pain_reported", true).in("session_athlete_id", ids).order("created_at", { ascending: false }).limit(200)),
    // Monthly-program session feedback (difficulty 0–5, pain notes) was never shown to the coach.
    selectInChunks<ProgramFeedbackRow>(athleteIds, (ids) => service.from("program_session_feedback").select("id,athlete_id,session_date,difficulty,enjoyment,pain_notes,created_at").eq("exercise_index", -1).in("athlete_id", ids).order("session_date", { ascending: false }).limit(200)),
  ])

  const saMap = new Map<string, SessionAthleteRow>(sessionAthleteRows.map((row) => [row.id, row]))
  const spIds = [...new Set(sessionAthleteRows.map((row) => row.session_post_id).filter((id): id is string => !!id))]
  const { data: spRows } = await selectInChunks<SessionPostRow>(spIds, (ids) => service.from("session_posts").select("id,title_en,session_date").in("id", ids))
  const spMap = new Map(((spRows ?? []) as SessionPostRow[]).map((sp) => [sp.id, sp]))
  const seIds = [...new Set(((rawPainRows ?? []) as PainRow[]).map((row) => row.session_exercise_id).filter((id): id is string => !!id))]
  const { data: seRows } = await selectInChunks<SessionExerciseRow>(seIds, (ids) => service.from("session_exercises").select("id,exercises(name_en)").in("id", ids))
  const seMap = new Map(((seRows ?? []) as SessionExerciseRow[]).map((se) => [se.id, se]))

  const feedbackSummaries = ((rawSummaries ?? []) as SummaryRow[]).map((row) => {
    const sa = saMap.get(row.session_athlete_id)
    const sp = sa?.session_post_id ? spMap.get(sa.session_post_id) : undefined
    return { id: row.id, athlete_id: sa?.athlete_id ?? "", session_post_id: sa?.session_post_id ?? "", session_title: sp?.title_en ?? t("Training session"), session_date: sp?.session_date ?? "", submitted_at: row.submitted_at, rpe: row.rpe, overall_rating: row.overall_rating, sleep_quality: row.sleep_quality, soreness_level: row.soreness_level, symptoms: row.symptoms, feedback_text: row.feedback_text }
  }).filter((row) => row.athlete_id)
  const programFeedbackSummaries = programFeedbackRows.map((row) => ({ id: `program-${row.id}`, athlete_id: row.athlete_id, session_post_id: "", session_title: t("Program session"), session_date: row.session_date, submitted_at: row.created_at ?? `${row.session_date}T12:00:00Z`, rpe: row.difficulty == null ? null : row.difficulty * 2, overall_rating: row.enjoyment, sleep_quality: null, soreness_level: null, symptoms: null, feedback_text: row.pain_notes }))
  const allFeedbackSummaries = [...feedbackSummaries, ...programFeedbackSummaries].sort((a, b) => String(b.submitted_at ?? "").localeCompare(String(a.submitted_at ?? "")))

  const feedbackPainReports = ((rawPainRows ?? []) as PainRow[]).map((row) => {
    const sa = saMap.get(row.session_athlete_id)
    const sp = sa?.session_post_id ? spMap.get(sa.session_post_id) : undefined
    const se = row.session_exercise_id ? seMap.get(row.session_exercise_id) : undefined
    const exName = Array.isArray(se?.exercises) ? se.exercises[0]?.name_en : se?.exercises?.name_en
    return { id: row.id, athlete_id: sa?.athlete_id ?? "", session_post_id: sa?.session_post_id ?? "", session_title: sp?.title_en ?? t("Training session"), session_date: sp?.session_date ?? "", exercise_name: exName ?? t("Exercise"), pain_location: row.pain_location, pain_severity: row.pain_severity, pain_notes: row.pain_notes, reported_at: row.created_at }
  }).filter((row) => row.athlete_id)
  const programPainReports = programFeedbackRows.filter((row) => row.pain_notes?.trim()).map((row) => ({ id: `program-pain-${row.id}`, athlete_id: row.athlete_id, session_post_id: "", session_title: t("Program session"), session_date: row.session_date, exercise_name: t("Whole session"), pain_location: null, pain_severity: null, pain_notes: row.pain_notes, reported_at: row.created_at ?? `${row.session_date}T12:00:00Z` }))
  const allPainReports = [...feedbackPainReports, ...programPainReports].sort((a, b) => String(b.reported_at ?? "").localeCompare(String(a.reported_at ?? "")))

  return (
    <>
      <DashboardTopBar />
      <GuidedTour role="admin" />
      <AdminErrorBoundary>
        <AdminBoard
          teams={teams ?? []}
          sessions={sessions ?? []}
          athletes={enrichedAthletes}
          exercises={catalogExercises}
          selfies={selfiesWithLinks}
          notifications={notifications ?? []}
          rules={rules ?? []}
          programs={programs ?? []}
          feedbackSummaries={allFeedbackSummaries}
          feedbackPainReports={allPainReports}
        />
      </AdminErrorBoundary>
    </>
  )
}
