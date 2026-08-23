import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { IntakeStepper } from "@/components/intake/intake-stepper"

export default async function IntakePage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    redirect("/auth/login")
  }

  const [{ data: profile }, { data: athlete }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", userData.user.id).single(),
    supabase.from("athletes").select("*").eq("id", userData.user.id).single(),
  ])

  if (profile?.role === "admin" || profile?.role === "supporting_coach") {
    redirect("/admin")
  }

  if (athlete?.intake_completed_at) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <IntakeStepper
          initial={{
            full_name: profile?.full_name ?? "",
            age: athlete?.age ?? null,
            phone: athlete?.phone ?? null,
            weight_kg: athlete?.weight_kg ?? null,
            height_cm: athlete?.height_cm ?? null,
            injury_notes: athlete?.injury_notes ?? "",
            goals: athlete?.goals ?? "",
          }}
        />
      </div>
    </main>
  )
}
