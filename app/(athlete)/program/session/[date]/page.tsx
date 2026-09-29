import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AthleteHeader } from "@/components/athlete/athlete-header"
import { ProgramSessionRunner } from "@/components/session/program-session-runner"

export default async function ProgramSessionPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: assignment } = await supabase.from("athlete_programs").select("id,month_start,generation_reason,status").eq("athlete_id", user.id).in("status", ["approved", "active"]).order("month_start", { ascending: false }).limit(1).maybeSingle()
  const sessions = Array.isArray((assignment?.generation_reason as any)?.sessions) ? (assignment?.generation_reason as any).sessions : []
  const session = sessions.find((item: any) => item.date === date)
  if (!session) notFound()
  const { data: feedback } = await supabase.from("program_session_feedback").select("exercise_index,difficulty,pain_notes,enjoyment").eq("athlete_id", user.id).eq("athlete_program_id", assignment.id).eq("session_date", date)
  return <div><AthleteHeader title="Program training" /><main className="px-4 py-6"><ProgramSessionRunner programId={assignment.id} date={date} time={session.time} exercises={session.exercises ?? []} initialFeedback={feedback ?? []} /></main></div>
}
