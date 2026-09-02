import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AssessmentForm } from "@/components/assessment/assessment-form"

export default async function AssessmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "admin" || profile?.role === "supporting_coach") redirect("/admin")
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto w-full max-w-2xl"><AssessmentForm /></div></main>
}
