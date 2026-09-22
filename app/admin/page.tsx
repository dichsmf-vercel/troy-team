import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminBoard } from "@/components/admin/admin-board"
import { DashboardTopBar } from "@/components/shared/dashboard-top-bar"
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export default async function AdminPage() {
  const requestId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = Date.now()
  console.log("[v0] admin request start", { requestId, path: "/admin" })
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log("[v0] admin auth check", { requestId, hasUser: Boolean(user), userId: user?.id, error: authError?.message })
  if (!user) redirect("/auth/login")
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  console.log("[v0] admin authorization check", { requestId, role: profile?.role, error: profileError?.message, authorized: Boolean(profile && ["admin", "supporting_coach"].includes(profile.role)) })
  if (!profile || !["admin", "supporting_coach"].includes(profile.role)) redirect("/dashboard")
  const [{ data: teams, error: teamsError }, { data: sessions, error: sessionsError }, { data: athletes, error: athletesError }, { data: exercises, error: exercisesError }, { data: selfies, error: selfiesError }, { data: notifications, error: notificationsError }, { data: rules, error: rulesError }, { data: programs, error: programsError }] = await Promise.all([
    supabase.from("teams").select("id, name_en, name_ar, color_hex, image_url, is_national_team").order("name_en"),
    supabase.from("session_posts").select("id, title_en, title_ar, notes, session_date, start_time, team_id, athlete_id, teams(name_en, name_ar)").order("session_date", { ascending: false }).limit(20),
    supabase.from("athletes").select("id, tier, assessment_status, medical_clearance_status, intake_completed_at, profiles!inner(full_name, full_name_ar, phone, role, subscription_tier, renewal_date, coach_private_notes), athlete_teams(team_id, teams(name_en, name_ar, image_url, color_hex))").eq("profiles.role", "athlete").order("created_at", { ascending: false }),
    supabase.from("exercises").select("id, name_en, name_ar, category, image_url, video_youtube_url, default_sets, default_reps").order("name_en"),
    supabase.from("session_selfies").select("id, image_url, uploaded_at, reviewed, session_athletes(athlete_id)").eq("reviewed", false).order("uploaded_at", { ascending: false }),
    supabase.from("notifications").select("id, title, body, is_read, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("program_rules").select("id, name, rule_type, condition_json, action_json, is_active, created_at").order("created_at", { ascending: false }),
    supabase.from("athlete_programs").select("id, athlete_id, status, month_start, month_end, generation_reason, athletes(profiles(full_name))").order("created_at", { ascending: false }),
  ])
  const service = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const authUsers = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authEmailById = new Map(authUsers.data.users.map((authUser) => [authUser.id, authUser.email ?? ""]))
  const athleteIds = (athletes ?? []).map((athlete) => athlete.id)
  const [{ data: measurements }, { data: inbodyRecords }] = athleteIds.length ? await Promise.all([supabase.from("measurements").select("athlete_id,height_cm,weight_kg,recorded_at").in("athlete_id", athleteIds).order("recorded_at", { ascending: false }), supabase.from("inbody_records").select("athlete_id,height_cm,weight_kg,recorded_at").in("athlete_id", athleteIds).order("recorded_at", { ascending: false })]) : [{ data: [] }, { data: [] }]
  const enrichedAthletes = (athletes ?? []).map((athlete) => ({ ...athlete, auth_email: authEmailById.get(athlete.id) ?? "", latest_measurement: measurements?.find((row) => row.athlete_id === athlete.id), latest_inbody: inbodyRecords?.find((row) => row.athlete_id === athlete.id) }))
  console.log("[v0] admin query complete", { requestId, elapsedMs: Date.now() - startedAt, datasets: { teams: teams?.length ?? 0, sessions: sessions?.length ?? 0, athletes: enrichedAthletes.length, exercises: exercises?.length ?? 0, selfies: selfies?.length ?? 0, notifications: notifications?.length ?? 0, rules: rules?.length ?? 0, programs: programs?.length ?? 0 }, queryErrors: { teams: teamsError?.message, sessions: sessionsError?.message, athletes: athletesError?.message, exercises: exercisesError?.message, selfies: selfiesError?.message, notifications: notificationsError?.message, rules: rulesError?.message, programs: programsError?.message } })
  if (!teams || !sessions || !athletes || !exercises || !selfies || !notifications || !rules || !programs) console.error("[v0] admin dataset query returned null", { teams: !teams, sessions: !sessions, athletes: !athletes, exercises: !exercises, selfies: !selfies, notifications: !notifications, rules: !rules, programs: !programs })
  return <><DashboardTopBar /><AdminErrorBoundary><AdminBoard teams={teams ?? []} sessions={sessions ?? []} athletes={enrichedAthletes} exercises={exercises ?? []} selfies={selfies ?? []} notifications={notifications ?? []} rules={rules ?? []} programs={programs ?? []} /></AdminErrorBoundary></>
}
