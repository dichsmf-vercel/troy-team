import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function RootPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single()

  if (profile?.role === "admin" || profile?.role === "supporting_coach") {
    redirect("/admin")
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("intake_completed_at")
    .eq("id", userData.user.id)
    .single()

  if (!athlete?.intake_completed_at) {
    redirect("/intake")
  }

  redirect("/dashboard")
}
