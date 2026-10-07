import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AthleteHeader } from "@/components/athlete/athlete-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Calendar, Target, AlertCircle } from "lucide-react"
import { SessionCard, type SessionCardData } from "@/components/dashboard/session-card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect("/auth/login")

  const [{ data: profile }, { data: athleteProfile }, { data: athleteProgram }, { data: athleteTeams }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userData.user.id).single(),
    supabase.from("athletes").select("id,account_status,assessment_status,medical_clearance_status,goals,injury_notes,height_cm,weight_kg").eq("id", userData.user.id).maybeSingle(),
    supabase.from("athlete_programs").select("*").eq("athlete_id", userData.user.id).in("status", ["approved", "active"]).order("month_start", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("athlete_teams").select("team_id, teams(id,name_en,name_ar,color_hex,image_url,is_national_team)").eq("athlete_id", userData.user.id),
  ])
  if (athleteProfile?.account_status === "paused") return <main className="grid min-h-screen place-items-center p-6"><Card className="max-w-md"><CardHeader><CardTitle>Account paused</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Your account is currently paused. Please contact your coach when you are ready to resume training.</p></CardContent></Card></main>
  const todayStr = new Date().toISOString().slice(0, 10)
  const teamIds = (athleteTeams ?? []).map((row: any) => row.team_id).filter(Boolean)
  const sessionFilter = teamIds.length ? `athlete_id.eq.${userData.user.id},team_id.in.(${teamIds.join(",")})` : `athlete_id.eq.${userData.user.id}`
  const { data: assignedPosts } = await supabase.from("session_posts").select("id,title_en,title_ar,session_date,start_time,team_id,athlete_id,teams(name_en,name_ar,color_hex,image_url,is_national_team)").or(sessionFilter).order("session_date", { ascending: true })
  const assignedPostIds = (assignedPosts ?? []).map((post: any) => post.id)
  const [{ data: assignedRows }, { data: attendanceRows }] = assignedPostIds.length ? await Promise.all([
    supabase.from("session_exercises").select("id,session_post_id").in("session_post_id", assignedPostIds),
    supabase.from("session_athletes").select("id,session_post_id,attended_at,completed_at,session_summaries(id)").eq("athlete_id", userData.user.id).in("session_post_id", assignedPostIds),
  ]) : [{ data: [] }, { data: [] }]
  const exerciseCountByPost = new Map<string, number>()
  for (const row of assignedRows ?? []) exerciseCountByPost.set(row.session_post_id, (exerciseCountByPost.get(row.session_post_id) ?? 0) + 1)
  const attendanceByPost = new Map((attendanceRows ?? []).map((row: any) => [row.session_post_id, row]))
  const assignedSessions: SessionCardData[] = (assignedPosts ?? []).map((post: any) => { const attendance = attendanceByPost.get(post.id); const team = post.teams ?? {}; return { sessionPostId: post.id, sessionAthleteId: attendance?.id ?? "", titleEn: post.title_en, titleAr: post.title_ar, sessionDate: post.session_date, period: post.start_time, exerciseCount: exerciseCountByPost.get(post.id) ?? 0, teamNameEn: team.name_en ?? "", teamNameAr: team.name_ar ?? "", teamImageUrl: team.image_url ?? null, colorHex: team.color_hex ?? "#888888", isNationalTeam: Boolean(team.is_national_team), hasSummary: Boolean(attendance?.session_summaries?.length), attendedAt: attendance?.attended_at ?? null } })
  const assignedToday = assignedSessions.filter((session) => session.sessionDate === todayStr)
  const assignedUpcoming = assignedSessions.filter((session) => session.sessionDate >= todayStr).slice(0, 5)
  const completedSessions = (attendanceRows ?? []).filter((row: any) => row.completed_at).length
  const upcomingSessions = assignedUpcoming.length
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


        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Today&apos;s training</h2>
            {programToday && <Badge variant="secondary" className="text-xs">Ready</Badge>}
          </div>
          {programToday ? <Link href={`/program/session/${programToday.date}`} className="rounded-2xl border border-accent/40 bg-accent/5 p-5 transition-colors hover:bg-accent/10"><p className="text-xs font-semibold uppercase tracking-wide text-accent">Program session</p><p className="mt-1 font-semibold">Today&apos;s program training</p><p className="mt-1 text-xs text-muted-foreground">{programToday.exercises?.length ?? 0} exercises · Start sequential training</p></Link> : <div className="rounded-2xl border border-dashed p-5 text-center"><Calendar className="mx-auto size-8 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Rest day</p><p className="text-xs text-muted-foreground">No program session scheduled for today</p></div>}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold tracking-tight">Assigned trainings</h2><p className="text-xs text-muted-foreground">Coach-assigned sessions follow the same exercise-by-exercise flow.</p></div>{assignedToday.length > 0 && <Badge variant="secondary" className="text-xs">Ready</Badge>}</div>
          {assignedToday.length > 0 ? <div className="flex flex-col gap-3">{assignedToday.map((session) => <SessionCard key={session.sessionPostId} session={session} />)}</div> : assignedUpcoming.length > 0 ? <div className="flex flex-col gap-3">{assignedUpcoming.map((session) => <SessionCard key={session.sessionPostId} session={session} />)}</div> : <div className="rounded-2xl border border-dashed p-5 text-center"><p className="text-sm font-medium">No assigned trainings</p><p className="text-xs text-muted-foreground">New coach assignments will appear here.</p></div>}
        </section>

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
              <p className="text-xs text-muted-foreground">Program status</p>
              <p className="mt-1 text-xl font-bold">{programStatus}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Today&apos;s exercises</p>
              <p className="mt-1 text-xl font-bold">{programToday?.exercises?.length ?? 0}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
