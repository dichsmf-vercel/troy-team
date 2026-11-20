import { loadAthleteToggles } from "@/lib/athlete-settings"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { AthleteHeader } from "@/components/athlete/athlete-header"
import { ProgramSessionRunner } from "@/components/session/program-session-runner"
import { Card } from "@/components/ui/card"
import { readProgramSessions, type StoredProgramExercise } from "@/lib/program-data"
import { resolveExerciseMedia } from "@/lib/exercise-media"
import { todayInAppZone } from "@/lib/dates"
import { getLocale, getT } from "@/lib/i18n/get-language"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ProgramSessionPage({ params }: { params: Promise<{ date: string }> }) {
  const t = await getT()
  const locale = await getLocale()
  const { date } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: assignment }, toggles] = await Promise.all([
    supabase
      .from("athlete_programs")
      .select("id,month_start,generation_reason,status")
      .eq("athlete_id", user.id)
      .in("status", ["approved", "active"])
      .order("month_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadAthleteToggles(supabase, user.id),
  ])

  const notice = (title: string, body: string) => (
    <div>
      <AthleteHeader title={t("Program training")} />
      <main className="px-4 py-6">
        <Card className="mx-auto grid max-w-lg gap-3 p-6 text-center">
          <CalendarClock className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-lg font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{body}</p>
          <Link href="/program" className="text-sm font-semibold text-primary underline underline-offset-4">{t("Back to program")}</Link>
        </Card>
      </main>
    </div>
  )

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound()
  const longDate = new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })
  if (!assignment) return notice(t("No monthly program yet"), t("Your coach hasn't assigned a monthly program. Check your dashboard for today's sessions."))
  const sessions = readProgramSessions(assignment.generation_reason)
  const session = sessions.find((item) => item.date === date)
  if (!session) return notice(t("No session on this day"), t("{date} is a rest day in your program.", { date: longDate }))

  // Future sessions can be previewed on the program page but not completed early.
  if (date > todayInAppZone()) {
    return notice(t("This session isn't open yet"), toggles.showUpcomingExercises ? t("It opens on {date}. You can preview the exercises on your program page.", { date: longDate }) : t("It opens on {date}.", { date: longDate }))
  }

  // Attach current media: the coach may have added a photo/video since the program was generated.
  const rawExercises = session.exercises ?? []
  const ids = [...new Set(rawExercises.map((exercise) => exercise.id).filter((id): id is string => !!id && UUID.test(id)))]
  const { data: catalogRows } = ids.length
    ? await supabase.from("exercises").select("id,image_url,video_youtube_url").in("id", ids)
    : { data: [] as { id: string; image_url: string | null; video_youtube_url: string | null }[] }
  const catalog = new Map((catalogRows ?? []).map((row) => [row.id, row]))
  const exercises: StoredProgramExercise[] = rawExercises.map((exercise) => {
    const row = exercise.id ? catalog.get(exercise.id) : undefined
    return {
      ...exercise,
      media: resolveExerciseMedia({
        name: exercise.name_en ?? exercise.name,
        image_url: row?.image_url ?? exercise.image_url,
        video_youtube_url: row?.video_youtube_url ?? exercise.video_youtube_url,
      }),
    }
  })

  const [{ data: feedback }, { data: completion }] = await Promise.all([
    supabase
      .from("program_session_feedback")
      .select("exercise_index,difficulty,pain_notes,enjoyment")
      .eq("athlete_id", user.id)
      .eq("athlete_program_id", assignment.id)
      .eq("session_date", date),
    supabase
      .from("program_session_completions")
      .select("status")
      .eq("athlete_id", user.id)
      .eq("athlete_program_id", assignment.id)
      .eq("session_date", date)
      .maybeSingle(),
  ])

  return (
    <div>
      <AthleteHeader title={t("Program training")} />
      <main className="px-4 py-6">
        <ProgramSessionRunner
          programId={assignment.id}
          date={date}
          time={session.time ?? ""}
          exercises={exercises}
          initialFeedback={feedback ?? []}
          initialCompleted={completion?.status === "completed"}
          showExerciseRecap={toggles.showExerciseRecap}
          selfieRequired={toggles.selfieRequired}
        />
      </main>
    </div>
  )
}
