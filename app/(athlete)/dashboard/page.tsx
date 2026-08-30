import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/get-language"
import { AthleteHeader } from "@/components/athlete/athlete-header"
import { SessionCard, type SessionCardData } from "@/components/dashboard/session-card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect("/auth/login")

  const { dict } = await getDictionary()

  const [{ data: profile }, { data: athleteTeams }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userData.user.id).single(),
    supabase.from("athlete_teams").select("team_id, teams(*)").eq("athlete_id", userData.user.id),
  ])

  const teamIds = (athleteTeams ?? []).map((row: any) => row.team_id)
  const teamsById = new Map((athleteTeams ?? []).map((row: any) => [row.team_id, row.teams]))

  let sessions: SessionCardData[] = []

  const sessionFilters = [`athlete_id.eq.${userData.user.id}`, ...(teamIds.length ? [`team_id.in.(${teamIds.join(",")})`] : [])].join(",")
  if (sessionFilters) {
    const { data: posts } = await supabase
      .from("session_posts")
      .select("*, session_exercises(id), teams(name_en, name_ar, color_hex, is_national_team)")
      .or(sessionFilters)
      .order("session_date", { ascending: true })

    const { data: mySessionAthletes } = await supabase.from("session_athletes").select("*, session_summaries(id)").eq("athlete_id", userData.user.id)
    const sessionAthleteByPost = new Map((mySessionAthletes ?? []).map((sa: any) => [sa.session_post_id, sa]))

    sessions = (posts ?? []).map((post: any) => {
      const team = post.teams ?? teamsById.get(post.team_id)
      const sa = sessionAthleteByPost.get(post.id)
      return {
        sessionAthleteId: sa?.id ?? "",
        sessionPostId: post.id,
        titleEn: post.title_en,
        titleAr: post.title_ar,
        sessionDate: post.session_date,
        period: post.period,
        exerciseCount: post.session_exercises?.length ?? 0,
        teamNameEn: team?.name_en ?? "",
        teamNameAr: team?.name_ar ?? "",
        colorHex: team?.color_hex ?? "#888888",
        isNationalTeam: Boolean(team?.is_national_team),
        hasSummary: Boolean(sa?.session_summaries?.length),
        attendedAt: sa?.attended_at ?? null,
      }
    })
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todaysSessions = sessions.filter((s) => s.sessionDate === todayStr)
  const upcomingSessions = sessions.filter((s) => s.sessionDate > todayStr)

  const firstName = profile?.full_name?.split(" ")[0] ?? ""

  return (
    <div>
      <AthleteHeader title={`${dict.dashboard.greeting}${firstName ? ", " + firstName : ""}`} />

      <div className="flex flex-col gap-8 px-4 py-6">
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {dict.dashboard.todaysSessions}
          </h2>
          {todaysSessions.length === 0 ? (
            <EmptyState message={dict.dashboard.noSessions} body={dict.dashboard.noSessionsBody} />
          ) : (
            <div className="flex flex-col gap-4">
              {todaysSessions.map((s) => (
                <SessionCard key={s.sessionPostId} session={s} />
              ))}
            </div>
          )}
        </section>

        {upcomingSessions.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {dict.dashboard.upcomingSessions}
            </h2>
            <div className="flex flex-col gap-4">
              {upcomingSessions.map((s) => (
                <SessionCard key={s.sessionPostId} session={s} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function EmptyState({ message, body }: { message: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="font-medium">{message}</p>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
    </div>
  )
}
