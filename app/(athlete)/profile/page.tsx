import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileEditor } from "@/components/profile/profile-editor"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { getT } from "@/lib/i18n/get-language"
import Link from "next/link"

export default async function ProfilePage() {
  const t = await getT()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const [{ data: profile }, { data: athlete }, { data: parentLink }] = await Promise.all([
    supabase.from("profiles").select("full_name, troy_id").eq("id", user.id).single(),
    supabase.from("athletes").select("parent_link_code, assessment_status").eq("id", user.id).single(),
    supabase.from("parent_links").select("link_code, status").eq("athlete_id", user.id).eq("status", "active").maybeSingle(),
  ])
  const athleteStatus = athlete
  // Troy-ID athletes sign in with an internal address: never show it as if it were their e-mail.
  const realEmail = user.email && !user.email.endsWith("@troy.internal") ? user.email : null
  return <div className="grid gap-4"><ProfileEditor troyId={profile?.troy_id ?? null} email={realEmail} profile={profile} parentCode={athlete?.parent_link_code ?? parentLink?.link_code ?? null} />{athleteStatus?.assessment_status !== "approved" ? <Card className="mx-4 border-amber-500/40 bg-amber-500/5"><CardContent className="flex gap-3 p-4"><AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" /><div><p className="text-sm font-medium">{t("Assessment incomplete")}</p><p className="mt-1 text-xs text-muted-foreground">{t("Complete your athlete assessment so your coach can tailor your program safely.")}</p><Link href="/assessment" className="mt-2 inline-flex text-xs font-semibold text-primary underline underline-offset-4">{t("Complete assessment")}</Link></div></CardContent></Card> : null}</div>
}
