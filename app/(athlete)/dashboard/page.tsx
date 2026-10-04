import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AthleteHeader } from "@/components/athlete/athlete-header"
import { SessionCard, type SessionCardData } from "@/components/dashboard/session-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowRight, Calendar, CheckCircle2, Flame, Target, AlertCircle } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect("/auth/login")

  const [{ data: profile }, { data: athleteTeams }, { data: athleteProfile }, { data: sessionAthletes }, { data: athleteProgram }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userData.user.id).single(),
    supabase.from("athlete_teams").select("team_id, teams(*)").eq("athlete_id", userData.user.id),
    supabase.from("athletes").select("id,account_status,assessment_status,medical_clearance_status,goals,injury_notes,height_cm,weight_kg").eq("id", userData.user.id).maybeSingle(),
    supabase.from("session_athletes").select("*, session_summaries(id)").eq("athlete_id", userData.user.id),
    supabase.from("athlete_programs").select("*").eq("athlete_id", userData.user.id).in("status", ["approved", "active"]).order("month_start", { ascending: false }).limit(1).maybeSingle(),
  ])
  if (athleteProfile?.account_status === "paused") return <main className="grid min-h-screen place-items-center p-6"><Card className="max-w-md"><CardHeader><CardTitle>Account paused</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Your account is currently paused. Please contact your coach when you are ready to resume training.</p></CardContent></Card></main>
  const teamIds = (athleteTeams ?? []).map((team: any) => team.team_id).filter(Boolean)
  const sessionFilter = teamIds.length ? `athlete_id.eq.${userData.user.id},team_id.in.(${teamIds.join(",")})` : `athlete_id.eq.${userData.user.id}`
  const { data: sessionPosts } = await supabase.from("session_posts").select("*, teams(name_en, name_ar, color_hex, image_url, is_national_team)").or(sessionFilter).order("session_date", { ascending: true })
  const postIds = (sessionPosts ?? []).map((post: any) => post.id)
  const { data: sessionExerciseRows } = postIds.length ? await supabase.from("session_exercises").select("id,session_post_id").in("session_post_id", postIds) : { data: [] }
  const exerciseCountByPost = new Map<string, number>()
  for (const row of sessionExerciseRows ?? []) exerciseCountByPost.set(row.session_post_id, (exerciseCountByPost.get(row.session_post_id) ?? 0) + 1)
  const assignedPostIds = (sessionAthletes ?? []).map((row: any) => row.session_post_id).filter(Boolean)
  const { data: directlyAssignedPosts } = assignedPostIds.length ? await supabase.from("session_posts").select("*, teams(name_en, name_ar, color_hex, image_url, is_national_team)").in("id", assignedPostIds) : { data: [] }
  const directPostIds = (directlyAssignedPosts ?? []).map((post: any) => post.id).filter((id: string) => !postIds.includes(id))
  if (directPostIds.length) { const { data: directExercises } = await supabase.from("session_exercises").select("id,session_post_id").in("session_post_id", directPostIds); for (const row of directExercises ?? []) exerciseCountByPost.set(row.session_post_id, (exerciseCountByPost.get(row.session_post_id) ?? 0) + 1) }
  const mergedSessionPosts = [...new Map([...(sessionPosts ?? []), ...(directlyAssignedPosts ?? [])].map((post: any) => [post.id, post])).values()]

  const teamsById = new Map((athleteTeams ?? []).map((row: any) => [row.team_id, row.teams]))
  const sessionAthleteByPost = new Map((sessionAthletes ?? []).map((sa: any) => [sa.session_post_id, sa]))

  const sessions: SessionCardData[] = mergedSessionPosts.map((post: any) => {
    const team = post.teams ?? teamsById.get(post.team_id)
    const sa = sessionAthleteByPost.get(post.id)
    const isComplete = Boolean(sa?.completed_at) && sa?.session_summaries?.length
    return {
      sessionAthleteId: sa?.id ?? "",
      sessionPostId: post.id,
      titleEn: post.title_en,
      titleAr: post.title_ar,
      sessionDate: post.session_date,
      period: post.start_time,
      exerciseCount: exerciseCountByPost.get(post.id) ?? 0,
      teamNameEn: team?.name_en ?? "",
      teamNameAr: team?.name_ar ?? "",
      teamImageUrl: team?.image_url ?? null,
      colorHex: team?.color_hex ?? "#888888",
      isNationalTeam: Boolean(team?.is_national_team),
      hasSummary: Boolean(sa?.session_summaries?.length),
      attendedAt: sa?.attended_at ?? null,
    }
  })

  const todayStr = new Date().toISOString().slice(0, 10)
  const todaysSessions = sessions.filter((s) => s.sessionDate === todayStr)
  const upcomingSessions = sessions.filter((s) => s.sessionDate > todayStr).slice(0, 3)
  const completedSessions = sessions.filter((s) => Boolean(s.attendedAt)).length
  const firstName = profile?.full_name?.split(" ")[0] ?? ""
  const programStatus = athleteProgram?.status === "approved" ? "Ready" : athleteProgram?.status === "active" ? "Active" : "Pending"
  const programSessions = Array.isArray((athleteProgram?.generation_reason as any)?.sessions) ? (athleteProgram?.generation_reason as any).sessions : []
  const programToday = programSessions.find((session: any) => session.date === todayStr)

  return (
    <div>
      <AthleteHeader title={`Welcome${firstName ? ", " + firstName : ""}`} />
      <main className="flex flex-col gap-6 px-4 py-6">
        <section className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/20"><div className="relative z-10 flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary-foreground/75">Your training space</p><h2 className="mt-1 text-3xl font-bold tracking-tight">Ready when you are.</h2><p className="mt-2 max-w-[18rem] text-sm text-primary-foreground/75">Stay consistent, follow your plan, and make today count.</p></div><Target className="size-12 shrink-0 text-primary-foreground/80" aria-hidden="true" /></div><div className="absolute -right-10 -top-10 size-36 rounded-full border-[18px] border-primary-foreground/10" /></section>
        {/* Status cards */}
        <section className="grid grid-cols-3 gap-2">
          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Program</p>
              <p className="mt-2 text-lg font-bold text-accent">{programStatus}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Completed</p>
              <p className="mt-2 text-lg font-bold text-primary">{completedSessions}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Upcoming</p>
              <p className="mt-2 text-lg font-bold">{upcomingSessions.length}</p>
            </CardContent>
          </Card>
        </section>


        {/* Today's sessions */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Today&apos;s training</h2>
            {todaysSessions.length > 0 && <Badge variant="secondary" className="text-xs">Ready</Badge>}
          </div>
          {todaysSessions.length === 0 && !programToday ? (
            <div className="rounded-2xl border border-dashed p-5 text-center">
              <Calendar className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Rest day</p>
              <p className="text-xs text-muted-foreground">No sessions scheduled for today</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {todaysSessions.map((s) => (
                <SessionCard key={s.sessionPostId} session={s} />
              ))}
              {programToday ? <Link href={`/program/session/${programToday.date}`} className="rounded-2xl border border-accent/40 bg-accent/5 p-5 transition-colors hover:bg-accent/10"><p className="text-xs font-semibold uppercase tracking-wide text-accent">Program session</p><p className="mt-1 font-semibold">Today&apos;s program training</p><p className="mt-1 text-xs text-muted-foreground">{programToday.exercises?.length ?? 0} exercises · Start sequential training</p></Link> : null}
            </div>
          )}
        </section>

        {/* Upcoming sessions */}
        {upcomingSessions.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming this week</h2>
            <div className="flex flex-col gap-3">
              {upcomingSessions.map((s) => (
                <SessionCard key={s.sessionPostId} session={s} />
              ))}
            </div>
          </section>
        )}

        {/* Program alert */}
        {athleteProgram?.status === "pending_review" && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-4 flex gap-3">
              <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Program under review</p>
                <p className="text-xs text-muted-foreground mt-1">Your coach is preparing your monthly training program. Check back soon!</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick stats */}
        <section className="grid gap-3 pt-4 border-t">
          <h3 className="text-sm font-semibold">Session stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Total sessions</p>
              <p className="mt-1 text-xl font-bold">{sessions.length}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Completion rate</p>
              <p className="mt-1 text-xl font-bold">{sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0}%</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
