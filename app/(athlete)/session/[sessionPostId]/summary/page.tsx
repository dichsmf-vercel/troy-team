import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SessionSummaryForm } from "@/components/session/session-summary-form"

export default async function SessionSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionPostId: string }>
  searchParams: Promise<{ sessionAthleteId?: string }>
}) {
  const { sessionPostId } = await params
  const { sessionAthleteId } = await searchParams

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect("/auth/login")

  let resolvedId = sessionAthleteId
  if (!resolvedId) {
    const { data } = await supabase
      .from("session_athletes")
      .select("id")
      .eq("session_post_id", sessionPostId)
      .eq("athlete_id", userData.user.id)
      .maybeSingle()
    resolvedId = data?.id
  }

  if (!resolvedId) redirect(`/session/${sessionPostId}`)

  return <SessionSummaryForm sessionAthleteId={resolvedId} sessionPostId={sessionPostId} />
}
