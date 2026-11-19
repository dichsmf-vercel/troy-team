import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AthleteHeader } from "@/components/athlete/athlete-header"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { readProgramSessions, readProgramSource, type StoredProgramExercise } from "@/lib/program-data"
import { exerciseDisplayName, resolveExerciseMedia } from "@/lib/exercise-media"
import { getLanguage, getLocale, getT } from "@/lib/i18n/get-language"
import { Calendar, AlertCircle, CheckCircle2, XCircle, Dumbbell, ArrowRight } from "lucide-react"
import { tx } from "@/lib/i18n/translate"
import { todayInAppZone, addDaysIso } from "@/lib/dates"

/** Keeps the program's own section order and names ("Strength/Power" was listed twice and "FMS Correction" was dropped before). */
function groupBySection(exercises: StoredProgramExercise[]) {
  const groups: { section: string; exercises: StoredProgramExercise[] }[] = []
  for (const exercise of exercises) {
    const section = String(exercise.section ?? "").trim() || "Training"
    const group = groups.find((item) => item.section.toLowerCase() === section.toLowerCase())
    if (group) group.exercises.push(exercise)
    else groups.push({ section, exercises: [exercise] })
  }
  return groups
}

export default async function AthleteProgramPage() {
  const t = await getT()
  const locale = await getLocale()
  const language = await getLanguage()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: assignment }, { data: athlete }] = await Promise.all([
    supabase
      .from("athlete_programs")
      .select("*")
      .eq("athlete_id", user.id)
      .in("status", ["approved", "active"])
      .order("month_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("athletes")
      .select("goals")
      .eq("id", user.id)
      .maybeSingle(),
  ])

  const isAssignedOnly = athlete?.goals?.includes("Assigned exercises only")
  const monthStart = assignment?.month_start ? new Date(`${assignment.month_start}T12:00:00`) : new Date()
  const programSessions = readProgramSessions(assignment?.generation_reason)
  const today = todayInAppZone()

  const { data: completionRows } = assignment
    ? await supabase
        .from("program_session_completions")
        .select("session_date,status,completed_at")
        .eq("athlete_program_id", assignment.id)
        .eq("athlete_id", user.id)
    : { data: [] }

  const completionByDate = new Map((completionRows ?? []).map((row: { session_date: string; status: string; completed_at: string | null }) => [row.session_date, row]))
  // Every session is listed: past ones show attended/missed, upcoming ones are a read-only preview.
  const visibleSessions = [...programSessions].sort((a, b) => a.date.localeCompare(b.date))
  const sessionDates = new Set(programSessions.map((session) => session.date))

  const monthTitle = monthStart.toLocaleDateString(locale, { month: "long", year: "numeric" })
  const startIso = assignment?.month_start ?? today
  const days = Array.from({ length: 28 }, (_, index) => {
    const iso = addDaysIso(startIso, index)
    return { day: Number(iso.slice(8, 10)), date: iso, hasSession: sessionDates.has(iso) }
  })

  return (
    <div>
      <AthleteHeader title={t("Monthly program")} />
      <main className="grid gap-6 px-4 py-6">
        {programSessions.length > 0 ? (
          <>
            {/* Program header */}
            <Card className="border-0 bg-gradient-to-br from-primary/10 to-accent/5">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{t("Your four-week training plan")}</p>
                <h1 className="mt-2 text-2xl font-bold text-balance">
                  {readProgramSource(assignment?.generation_reason) ? t("Custom program") : t("Monthly Program")}
                </h1>
                <div className="mt-3 flex items-center gap-2">
                  {assignment?.status === "approved" ? (
                    <Badge className="gap-1"><CheckCircle2 className="size-3" /> {t("Ready to start")}</Badge>
                  ) : assignment?.status === "active" ? (
                    <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> {t("In progress")}</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1"><Calendar className="size-3" /> {t("Pending approval")}</Badge>
                  )}
                  {assignment?.month_start && (
                    <span className="text-xs text-muted-foreground">
                      {t("Starting")} {new Date(assignment.month_start).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Calendar */}
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{monthTitle}</h2>
                <span className="text-xs text-muted-foreground">{t("Calendar view")}</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                {[tx("Sun"), tx("Mon"), tx("Tue"), tx("Wed"), tx("Thu"), tx("Fri"), tx("Sat")].map((day) => (
                  <span key={day} className="py-2 font-medium text-muted-foreground">
                    {t(day)}
                  </span>
                ))}
                {/* The grid starts on the program's first day, so pad to line it up under the right weekday. */}
                {Array.from({ length: monthStart.getDay() }, (_, index) => (
                  <span key={`pad-${index}`} aria-hidden="true" />
                ))}
                {days.map((item) => (
                  <div
                    key={item.date}
                    className={`min-h-14 rounded-xl border-2 p-1 flex flex-col items-center justify-center transition-colors ${
                      item.date < today ? "opacity-55" : ""
                    } ${
                      item.date === today
                        ? "border-4 border-primary bg-primary/10 ring-2 ring-primary/30"
                        : item.hasSession
                        ? "border-accent bg-accent/10"
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <span className={`text-xs font-bold ${item.date === today ? "text-primary" : ""}`}>
                      {item.day}
                      {item.date === today ? <span className="sr-only"> {t("today")}</span> : null}
                    </span>
                    {item.hasSession && completionByDate.get(item.date)?.status === "completed" ? (
                      <CheckCircle2 className="mt-1 size-4 text-emerald-500" aria-label={t("Attended")} />
                    ) : item.hasSession && item.date < today ? (
                      <XCircle className="mt-1 size-4 text-red-500" aria-label={t("Missed")} />
                    ) : item.hasSession ? (
                      <span className="mt-1 size-1.5 rounded-full bg-accent" />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {/* Session details */}
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">{t("Training sessions")}</h2>
              <div className="flex flex-col gap-3">
                {visibleSessions.map((session, idx) => (
                  <Card key={idx} className="border-0 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span
                          className={
                            completionByDate.get(session.date)?.status === "completed"
                              ? "flex items-center gap-1 text-xs font-semibold text-emerald-500"
                              : session.date < today
                              ? "flex items-center gap-1 text-xs font-semibold text-red-500"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {completionByDate.get(session.date)?.status === "completed" ? (
                            <><CheckCircle2 className="size-4" aria-hidden="true" /> {t("Attended")}</>
                          ) : session.date < today ? (
                            <><XCircle className="size-4" aria-hidden="true" /> {t("Missed")}</>
                          ) : session.date === today ? (
                            t("Available today")
                          ) : (
                            t("Upcoming")
                          )}
                        </span>
                        {completionByDate.get(session.date)?.status === "completed" ? (
                          <CheckCircle2 className="size-5 text-emerald-500" aria-label={t("Attended")} />
                        ) : session.date < today ? (
                          <Link
                            href={`/program/session/${session.date}`}
                            className="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-500"
                          >
                            {t("Catch up")}
                          </Link>
                        ) : session.date === today ? (
                          <Link
                            href={`/program/session/${session.date}`}
                            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                          >
                            {t("Start training")}
                          </Link>
                        ) : null}
                      </div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            {t("Week {week} • {time}", { week: session.week, time: session.time })}
                          </p>
                          <h3 className="mt-1 text-sm font-semibold">
                            {new Date(`${session.date}T12:00:00`).toLocaleDateString(locale, {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })}
                          </h3>
                        </div>
                        {session.tooFewExercises && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertCircle className="size-3" /> {t("Review")}
                          </Badge>
                        )}
                      </div>

                      {/* Sections */}
                      <div className="space-y-3">
                        {groupBySection(session.exercises ?? []).map(({ section, exercises: sectionExercises }) => {
                          return (
                            <div key={section}>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{t(section)}</p>
                              <div className="space-y-1.5">
                                {sectionExercises.map((exercise, exIdx) => (
                                  <div key={exIdx} className="rounded-lg bg-muted/50 p-2 flex items-center justify-between gap-2 text-xs">
                                    <span className="flex min-w-0 items-center gap-2">
                                      {resolveExerciseMedia({ name: exercise.name_en ?? exercise.name, image_url: exercise.image_url }).images[0] ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- small static thumbnail
                                        <img
                                          src={resolveExerciseMedia({ name: exercise.name_en ?? exercise.name, image_url: exercise.image_url }).images[0]}
                                          alt=""
                                          className="size-9 shrink-0 rounded-md object-cover"
                                          loading="lazy"
                                        />
                                      ) : null}
                                      <span className="font-medium truncate">{exerciseDisplayName(exercise.name_en ?? exercise.name, null, language)}</span>
                                    </span>
                                    <span className="text-muted-foreground text-nowrap">
                                      {exercise.sets}×{exercise.reps}
                                      {exercise.loadPercentage ? ` @ ${exercise.loadPercentage}%` : ""}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </>
        ) : (
          /* Friendly Illustrated Empty State */
          <div className="rounded-2xl border bg-card p-8 text-center sm:p-12">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <Dumbbell className="size-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold">
              {isAssignedOnly ? t("Assigned Exercises Mode") : t("No Program Assigned Yet")}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {isAssignedOnly
                ? t("Your account is set to train using coach-assigned daily sessions. Check your dashboard for today's workout.")
                : t("Coach Ahmed has not generated a monthly program for your account yet. You can still access individual sessions assigned to you.")}
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                {t("Go to Today's Dashboard")} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
