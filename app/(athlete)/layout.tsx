import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BottomNav } from "@/components/athlete/bottom-nav"
import { DashboardTopBar } from "@/components/shared/dashboard-top-bar"

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single()

  if (profile?.role === "admin" || profile?.role === "supporting_coach") {
    redirect("/admin")
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <DashboardTopBar />
      <div className="mx-auto max-w-md">{children}</div>
      <BottomNav />
    </div>
  )
}
