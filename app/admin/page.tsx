import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminBoard } from "@/components/admin/admin-board"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "supporting_coach"].includes(profile.role)) redirect("/dashboard")
  const [{ data: teams }, { data: sessions }, { data: athletes }, { data: exercises }, { data: selfies }] = await Promise.all([
    supabase.from("teams").select("id, name_en, name_ar, color_hex, is_national_team").order("name_en"),
    supabase.from("session_posts").select("id, title_en, title_ar, session_date, period, team_id, teams(name_en, name_ar)").order("session_date", { ascending: false }).limit(20),
    supabase.from("athletes").select("id, tier, intake_completed_at, profiles(full_name), athlete_teams(team_id, teams(name_en, name_ar))").order("created_at", { ascending: false }),
    supabase.from("exercises").select("id, name_en, name_ar, category, image_url, video_youtube_url, default_sets, default_reps").order("name_en"),
    supabase.from("session_selfies").select("id, image_url, uploaded_at, reviewed, session_athletes(athlete_id, profiles(full_name))").eq("reviewed", false).order("uploaded_at", { ascending: false }),
  ])
  return <AdminBoard teams={teams ?? []} sessions={sessions ?? []} athletes={athletes ?? []} exercises={exercises ?? []} selfies={selfies ?? []} />
}
