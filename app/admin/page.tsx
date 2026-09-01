import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminBoard } from "@/components/admin/admin-board"
import { ProgramsPanel } from "@/components/admin/programs-panel"
import { DashboardTopBar } from "@/components/shared/dashboard-top-bar"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "supporting_coach"].includes(profile.role)) redirect("/dashboard")
  const [{ data: teams }, { data: sessions }, { data: athletes }, { data: exercises }, { data: selfies }, { data: notifications }, { data: rules }, { data: programs }] = await Promise.all([
    supabase.from("teams").select("id, name_en, name_ar, color_hex, image_url, is_national_team").order("name_en"),
    supabase.from("session_posts").select("id, title_en, title_ar, notes, session_date, start_time, team_id, athlete_id, teams(name_en, name_ar)").order("session_date", { ascending: false }).limit(20),
    supabase.from("athletes").select("id, tier, intake_completed_at, profiles(full_name, subscription_tier, renewal_date, coach_private_notes), athlete_teams(team_id, teams(name_en, name_ar))").order("created_at", { ascending: false }),
    supabase.from("exercises").select("id, name_en, name_ar, category, image_url, video_youtube_url, default_sets, default_reps").order("name_en"),
    supabase.from("session_selfies").select("id, image_url, uploaded_at, reviewed, session_athletes(athlete_id, profiles(full_name))").eq("reviewed", false).order("uploaded_at", { ascending: false }),
    supabase.from("notifications").select("id, title, body, is_read, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("program_rules").select("id, name, rule_type, condition_json, action_json, is_active, created_at").order("created_at", { ascending: false }),
    supabase.from("programs").select("id, name_en, name_ar, description_en, description_ar, status, created_at").order("created_at", { ascending: false }),
  ])
  console.log("[v0] admin datasets", { teams: teams?.length ?? 0, sessions: sessions?.length ?? 0, athletes: athletes?.length ?? 0, exercises: exercises?.length ?? 0, selfies: selfies?.length ?? 0, notifications: notifications?.length ?? 0, rules: rules?.length ?? 0, programs: programs?.length ?? 0 })
  return <><DashboardTopBar /><AdminBoard teams={teams ?? []} sessions={sessions ?? []} athletes={athletes ?? []} exercises={exercises ?? []} selfies={selfies ?? []} notifications={notifications ?? []} rules={rules ?? []} programs={programs ?? []} /><section className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8"><ProgramsPanel programs={programs ?? []} exercises={exercises ?? []} /></section></>
}
