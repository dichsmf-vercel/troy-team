import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AthleteHeader } from "@/components/athlete/athlete-header"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, AlertCircle, CheckCircle2 } from "lucide-react"

export default async function AthleteProgramPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: assignment } = await supabase
    .from("athlete_programs")
    .select("*")
    .eq("athlete_id", user.id)
    .in("status", ["approved", "active"])
    .order("month_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  const monthStart = assignment?.month_start ? new Date(`${assignment.month_start}T12:00:00`) : new Date()
  const programSessions = Array.isArray((assignment?.generation_reason as any)?.sessions) ? (assignment?.generation_reason as any).sessions : []
  const sessionDates = new Set(programSessions.map((session: any) => session.date))
  
  const monthTitle = monthStart.toLocaleDateString("en", { month: "long", year: "numeric" })
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(monthStart)
    date.setDate(monthStart.getDate() + index)
    return {
      day: date.getDate(),
      weekday: date.toLocaleDateString("en", { weekday: "short" }),
      date: date.toISOString().slice(0, 10),
      hasSession: sessionDates.has(date.toISOString().slice(0, 10)),
    }
  })

  return (
    <div>
      <AthleteHeader title="Monthly program" />
      <main className="grid gap-6 px-4 py-6">
        {/* Program header */}
        <Card className="border-0 bg-gradient-to-br from-primary/10 to-accent/5">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Your four-week training plan</p>
            <h1 className="mt-2 text-2xl font-bold text-balance">{(assignment?.generation_reason as any)?.source ? "Custom program" : "No program yet"}</h1>
            <div className="mt-3 flex items-center gap-2">
              {assignment?.status === "approved" ? (
                <Badge className="gap-1"><CheckCircle2 className="size-3" /> Ready to start</Badge>
              ) : assignment?.status === "active" ? (
                <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> In progress</Badge>
              ) : (
                <Badge variant="outline" className="gap-1"><Calendar className="size-3" /> Pending approval</Badge>
              )}
              {assignment?.month_start && <span className="text-xs text-muted-foreground">Starting {new Date(assignment.month_start).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>}
            </div>
          </CardContent>
        </Card>

        {/* Alert if pending */}
        {assignment?.status === "pending_review" && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-4 flex gap-3">
              <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Program under review</p>
                <p className="text-xs text-muted-foreground mt-1">Your coach is reviewing your monthly training plan. Check back in 24 hours.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {programSessions.length > 0 ? (
          <>
            {/* Calendar */}
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{monthTitle}</h2>
                <span className="text-xs text-muted-foreground">Calendar view</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <span key={day} className="py-2 font-medium text-muted-foreground">
                    {day}
                  </span>
                ))}
                {days.map((item) => (
                  <div
                    key={item.date}
                    className={`min-h-14 rounded-xl border-2 p-1 flex flex-col items-center justify-center transition-colors ${
                      item.hasSession ? "border-accent bg-accent/10" : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xs font-bold">{item.day}</span>
                    {item.hasSession && <span className="mt-1 size-1.5 rounded-full bg-accent" />}
                  </div>
                ))}
              </div>
            </section>

            {/* Session details */}
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">Training sessions</h2>
              <div className="flex flex-col gap-3">
                {programSessions.map((session: any, idx: number) => (
                  <Card key={idx} className="border-0 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="mb-3 flex justify-end"><Link href={`/program/session/${session.date}`} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Start training</Link></div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Week {session.week} • {session.time}
                          </p>
                          <h3 className="mt-1 text-sm font-semibold">
                            {new Date(`${session.date}T12:00:00`).toLocaleDateString("en", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })}
                          </h3>
                        </div>
                        {session.tooFewExercises && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertCircle className="size-3" /> Review
                          </Badge>
                        )}
                      </div>

                      {/* Sections */}
                      <div className="space-y-3">
                        {["warm-up", "mobility", "power", "strength", "accessory", "conditioning", "cooldown"].map((section) => {
                          const sectionExercises = (session.exercises ?? []).filter((e: any) => e.section === section)
                          if (sectionExercises.length === 0) return null
                          return (
                            <div key={section}>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{section}</p>
                              <div className="space-y-1.5">
                                {sectionExercises.map((exercise: any, exIdx: number) => (
                                  <div key={exIdx} className="rounded-lg bg-muted/50 p-2 flex items-center justify-between gap-2 text-xs">
                                    <span className="font-medium truncate">{exercise.name_en}</span>
                                    <span className="text-muted-foreground text-nowrap">
                                      {exercise.sets}×{exercise.reps}
                                      {exercise.loadPercentage ? ` ${exercise.loadPercentage}%` : ""}
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
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <Calendar className="mx-auto size-12 text-muted-foreground opacity-50" />
            <p className="mt-3 text-sm font-medium">No program scheduled yet</p>
            <p className="text-xs text-muted-foreground mt-1">Your coach will create your monthly training program soon</p>
          </div>
        )}
      </main>
    </div>
  )
}
