import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AthleteHeader } from "@/components/athlete/athlete-header"
import { ProgramSessionRunner } from "@/components/session/program-session-runner"
import { readProgramSessions } from "@/lib/program-data"

export default async function ProgramSessionPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: assignment }, { data: athleteRecord }] = await Promise.all([
    supabase
      .from("athlete_programs")
      .select("id,month_start,generation_reason,status")
      .eq("athlete_id", user.id)
      .in("status", ["approved", "active"])
      .order("month_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("athletes")
      .select("show_exercise_recap")
      .eq("id", user.id)
      .maybeSingle(),
  ])

  if (!assignment) notFound()
  const sessions = readProgramSessions(assignment.generation_reason)
  const session = sessions.find((item) => item.date === date)
  if (!session) notFound()

  const { data: feedback } = await supabase
    .from("program_session_feedback")
    .select("exercise_index,difficulty,pain_notes,enjoyment")
    .eq("athlete_id", user.id)
    .eq("athlete_program_id", assignment.id)
    .eq("session_date", date)

  const { data: completion } = await supabase
    .from("program_session_completions")
    .select("status")
    .eq("athlete_id", user.id)
    .eq("athlete_program_id", assignment.id)
    .eq("session_date", date)
    .maybeSingle()

  return (
    <div>
      <AthleteHeader title="Program training" />
      <main className="px-4 py-6">
        <ProgramSessionRunner
          programId={assignment.id}
          date={date}
          time={session.time ?? ""}
          exercises={session.exercises ?? []}
          initialFeedback={feedback ?? []}
          initialCompleted={completion?.status === "completed"}
          showExerciseRecap={athleteRecord?.show_exercise_recap ?? true}
        />
      </main>
    </div>
  )
}
