import type { SupabaseClient } from "@supabase/supabase-js"
import { firstRelation } from "@/lib/utils"
import { readProgramSessions } from "@/lib/program-data"
import { todayInAppZone } from "@/lib/dates"

/**
 * One view of an athlete's training across BOTH sources:
 *  - coach-assigned sessions (session_posts → session_athletes / session_summaries, RPE 1–10)
 *  - monthly program sessions (athlete_programs JSON → program_session_completions / program_session_feedback,
 *    difficulty 0–5, shown on the same 0–10 scale by doubling it)
 * Used by the athlete Progress page and the parent view, so both always agree.
 */

export type AttendanceEntry = {
  date: string
  title: string
  kind: "assigned" | "program"
  status: "present" | "absent"
}

export type RpeEntry = { date: string; rpe: number; kind: "assigned" | "program" }

export type UpcomingEntry = { date: string; title: string; kind: "assigned" | "program" }

export type AthleteActivity = {
  attendance: AttendanceEntry[]
  rpe: RpeEntry[]
  upcoming: UpcomingEntry[]
  painFlags: number
}

type SessionAthleteRow = {
  id: string
  status: string | null
  attended_at: string | null
  completed_at: string | null
  session_post_id: string
  session_posts?: { title_en?: string | null; session_date?: string | null } | { title_en?: string | null; session_date?: string | null }[] | null
}

export async function loadAthleteActivity(
  supabase: SupabaseClient,
  athleteId: string,
  labels: { programSession: string; trainingSession: string },
): Promise<AthleteActivity> {
  const today = todayInAppZone()

  const [{ data: sessionRows }, { data: program }, { data: teamRows }] = await Promise.all([
    supabase
      .from("session_athletes")
      .select("id,status,attended_at,completed_at,session_post_id,session_posts(title_en,session_date)")
      .eq("athlete_id", athleteId),
    supabase
      .from("athlete_programs")
      .select("id,generation_reason")
      .eq("athlete_id", athleteId)
      .in("status", ["approved", "active"])
      .order("month_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("athlete_teams").select("team_id").eq("athlete_id", athleteId),
  ])

  const rows = (sessionRows ?? []) as unknown as SessionAthleteRow[]
  const sessionIds = rows.map((row) => row.id)

  const [{ data: summaries }, { data: painRows }, completionsResult, feedbackResult] = await Promise.all([
    sessionIds.length
      ? supabase.from("session_summaries").select("rpe,submitted_at").in("session_athlete_id", sessionIds)
      : Promise.resolve({ data: [] as { rpe: number | null; submitted_at: string | null }[] }),
    sessionIds.length
      ? supabase.from("exercise_completions").select("id").eq("pain_reported", true).in("session_athlete_id", sessionIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    program
      ? supabase.from("program_session_completions").select("session_date,status").eq("athlete_program_id", program.id).eq("athlete_id", athleteId)
      : Promise.resolve({ data: [] as { session_date: string; status: string }[] }),
    program
      ? supabase
          .from("program_session_feedback")
          .select("session_date,difficulty,pain_notes,exercise_index")
          .eq("athlete_program_id", program.id)
          .eq("athlete_id", athleteId)
          .eq("exercise_index", -1)
      : Promise.resolve({ data: [] as { session_date: string; difficulty: number | null; pain_notes: string | null; exercise_index: number }[] }),
  ])

  // Coach-assigned sessions
  const attendance: AttendanceEntry[] = []
  const assignedPostIds = new Set<string>()
  for (const row of rows) {
    const post = firstRelation(row.session_posts)
    const date = post?.session_date ?? row.attended_at?.slice(0, 10) ?? ""
    if (!date || date > today) continue
    assignedPostIds.add(row.session_post_id)
    const present = row.status === "present" || !!row.attended_at || !!row.completed_at
    attendance.push({ date, title: post?.title_en ?? labels.trainingSession, kind: "assigned", status: present ? "present" : "absent" })
  }

  // Program sessions
  const programSessions = program ? readProgramSessions(program.generation_reason) : []
  const completed = new Set((completionsResult.data ?? []).filter((row) => row.status === "completed").map((row) => row.session_date))
  for (const session of programSessions) {
    if (session.date > today) continue
    // Today's session is only "missed" once the day is over.
    if (session.date === today && !completed.has(session.date)) continue
    attendance.push({ date: session.date, title: labels.programSession, kind: "program", status: completed.has(session.date) ? "present" : "absent" })
  }
  attendance.sort((a, b) => a.date.localeCompare(b.date))

  const rpe: RpeEntry[] = [
    ...(summaries ?? [])
      .filter((row) => Number.isFinite(Number(row.rpe)))
      .map((row) => ({ date: String(row.submitted_at ?? "").slice(0, 10), rpe: Number(row.rpe), kind: "assigned" as const })),
    ...(feedbackResult.data ?? [])
      .filter((row) => row.difficulty != null)
      .map((row) => ({ date: row.session_date, rpe: Number(row.difficulty) * 2, kind: "program" as const })),
  ]
    .filter((entry) => entry.date)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Upcoming: next program sessions + coach posts for this athlete or their teams.
  const teamIds = (teamRows ?? []).map((row: { team_id: string | null }) => row.team_id).filter((id): id is string => !!id)
  const [{ data: directPosts }, teamPostsResult] = await Promise.all([
    supabase.from("session_posts").select("id,title_en,session_date").eq("athlete_id", athleteId).gte("session_date", today),
    teamIds.length
      ? supabase.from("session_posts").select("id,title_en,session_date").in("team_id", teamIds).gte("session_date", today)
      : Promise.resolve({ data: [] as { id: string; title_en: string | null; session_date: string }[] }),
  ])
  const posts = new Map([...(directPosts ?? []), ...(teamPostsResult.data ?? [])].map((post) => [post.id, post]))
  const upcoming: UpcomingEntry[] = [
    ...[...posts.values()].map((post) => ({ date: post.session_date, title: post.title_en ?? labels.trainingSession, kind: "assigned" as const })),
    ...programSessions
      .filter((session) => session.date >= today && !completed.has(session.date))
      .map((session) => ({ date: session.date, title: labels.programSession, kind: "program" as const })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)

  const programPainNotes = (feedbackResult.data ?? []).filter((row) => row.pain_notes?.trim()).length
  return { attendance, rpe, upcoming, painFlags: (painRows ?? []).length + programPainNotes }
}
