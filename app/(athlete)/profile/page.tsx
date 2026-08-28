import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileEditor } from "@/components/profile/profile-editor"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const [{ data: profile }, { data: parentLink }] = await Promise.all([
    supabase.from("profiles").select("full_name, profile_picture_url, language_preference").eq("id", user.id).single(),
    supabase.from("parent_links").select("link_code, status").eq("athlete_id", user.id).eq("status", "active").maybeSingle(),
  ])
  return <ProfileEditor userId={user.id} email={user.email ?? ""} profile={profile} parentLink={parentLink} />
}
