import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminBoard } from "@/components/admin/admin-board"
import { DashboardTopBar } from "@/components/shared/dashboard-top-bar"
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary"

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
  const [{ data: teams }, { data: sessions }, { data: athletes }, { data: exercises }, { data: selfies }, { data: notifications }, { data: rules }, { data: programs }] = await Promise.all([
    supabase.from("teams").select("id, name_en, name_ar, color_hex, image_url, is_national_team").order("name_en"),
    supabase.from("session_posts").select("id, title_en, title_ar, notes, session_date, start_time, team_id, athlete_id, teams(name_en, name_ar)").order("session_date", { ascending: false }).limit(20),
    supabase.from("athletes").select("id, tier, assessment_status, medical_clearance_status, intake_completed_at, profiles(full_name, subscription_tier, renewal_date, coach_private_notes), athlete_teams(team_id, teams(name_en, name_ar, image_url, color_hex))").order("created_at", { ascending: false }),
    supabase.from("exercises").select("id, name_en, name_ar, category, image_url, video_youtube_url, default_sets, default_reps").order("name_en"),
    supabase.from("session_selfies").select("id, image_url, uploaded_at, reviewed, session_athletes(athlete_id, profiles(full_name))").eq("reviewed", false).order("uploaded_at", { ascending: false }),
    supabase.from("notifications").select("id, title, body, is_read, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("program_rules").select("id, name, rule_type, condition_json, action_json, is_active, created_at").order("created_at", { ascending: false }),
    supabase.from("programs").select("id, name_en, name_ar, description_en, description_ar, status, created_at").order("created_at", { ascending: false }),
  ])
  console.log("[v0] admin query complete", { requestId, elapsedMs: Date.now() - startedAt, datasets: { teams: teams?.length ?? 0, sessions: sessions?.length ?? 0, athletes: athletes?.length ?? 0, exercises: exercises?.length ?? 0, selfies: selfies?.length ?? 0, notifications: notifications?.length ?? 0, rules: rules?.length ?? 0, programs: programs?.length ?? 0 }, athleteShape: athletes?.slice(0, 5).map((athlete) => ({ keys: Object.keys(athlete ?? {}), idType: typeof athlete?.id, profileKind: Array.isArray(athlete?.profiles) ? "array" : typeof athlete?.profiles, teamKind: Array.isArray(athlete?.athlete_teams) ? "array" : typeof athlete?.athlete_teams })) })
  if (!teams || !sessions || !athletes || !exercises || !selfies || !notifications || !rules || !programs) console.error("[v0] admin dataset query returned null", { teams: !teams, sessions: !sessions, athletes: !athletes, exercises: !exercises, selfies: !selfies, notifications: !notifications, rules: !rules, programs: !programs })
  return <><DashboardTopBar /><AdminErrorBoundary><AdminBoard teams={teams ?? []} sessions={sessions ?? []} athletes={athletes ?? []} exercises={exercises ?? []} selfies={selfies ?? []} notifications={notifications ?? []} rules={rules ?? []} programs={programs ?? []} /></AdminErrorBoundary></>
}
