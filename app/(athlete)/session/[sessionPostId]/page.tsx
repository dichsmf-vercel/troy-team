import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getLanguage } from "@/lib/i18n/get-language"
import { SessionRunner } from "@/components/session/session-runner"

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionPostId: string }>
}) {
  const { sessionPostId } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect("/auth/login")

  const language = await getLanguage()

  const { data: athleteTeams } = await supabase.from("athlete_teams").select("team_id").eq("athlete_id", userData.user.id)
  const teamIds = (athleteTeams ?? []).map((row: any) => row.team_id)

  const { data: post } = await supabase
    .from("session_posts")
    .select(
      "id, title_en, title_ar, notes, notes_en, notes_ar, session_date, start_time, period, team_id, athlete_id, teams(name_en, name_ar, color_hex, is_national_team)",
    )
    .eq("id", sessionPostId)
    .maybeSingle()

  const { data: sessionAthlete } = await supabase.from("session_athletes").select("id, attended_at").eq("session_post_id", sessionPostId).eq("athlete_id", userData.user.id).maybeSingle()
  if (!post) notFound()
  const teamVisible = post.team_id && teamIds.includes(post.team_id)
  const athleteVisible = post.athlete_id === userData.user.id
  if (!teamVisible && !athleteVisible && !sessionAthlete) notFound()

  const { data: exercises, error: exercisesError } = await supabase
    .from("session_exercises")
    .select("id, exercise_id, sort_order, exercise_order, sets, reps, exercises(id, name_en, name_ar, description_en, description_ar, image_url, video_youtube_url)")
    .eq("session_post_id", sessionPostId)
    .order("exercise_order", { ascending: true })
  console.log("[v0] session exercise resolution", { sessionPostId, athleteId: userData.user.id, postFound: Boolean(post), sessionAthleteId: sessionAthlete?.id ?? null, exerciseCount: exercises?.length ?? 0, exerciseError: exercisesError?.message, exerciseIds: (exercises ?? []).map((row: any) => row.exercise_id), rows: exercises })

  const { data: existingSelfie } = sessionAthlete?.id ? await supabase.from("session_selfies").select("id").eq("session_athlete_id", sessionAthlete.id).maybeSingle() : { data: null }

  let completions: { session_exercise_id: string; completed: boolean }[] = []
  if (sessionAthlete?.id) {
    const { data } = await supabase
      .from("exercise_completions")
      .select("session_exercise_id, completed")
      .eq("session_athlete_id", sessionAthlete.id)
    completions = data ?? []
  }

  const team = post.teams as unknown as {
    name_en: string
    name_ar: string
    color_hex: string
    is_national_team: boolean
  } | null

  return (
    <SessionRunner
      language={language}
      sessionPostId={post.id}
      title={language === "ar" ? post.title_ar : post.title_en}
      notes={language === "ar" ? (post.notes_ar || post.notes) : (post.notes_en || post.notes)}
      teamName={team ? (language === "ar" ? team.name_ar : team.name_en) : ""}
      teamColor={team?.color_hex ?? "#94A3B8"}
      isNationalTeam={team?.is_national_team ?? false}
      sessionDate={post.session_date}
      period={post.start_time ? String(post.start_time).slice(0, 5) : "00:00"}
      exercises={(exercises ?? []).map((se) => {
        const ex = se.exercises as unknown as {
          id: string
          name_en: string
          name_ar: string
          description_en: string | null
          description_ar: string | null
          image_url: string | null
          video_youtube_url: string | null
        }
        return {
          sessionExerciseId: se.id,
          exerciseId: ex.id,
          name: language === "ar" ? ex.name_ar : ex.name_en,
          description: language === "ar" ? ex.description_ar : ex.description_en,
          imageUrl: ex.image_url,
          videoUrl: ex.video_youtube_url,
          sets: se.sets,
          reps: se.reps,
        }
      })}
      initialSessionAthleteId={sessionAthlete?.id ?? null}
      initialAttendedAt={sessionAthlete?.attended_at ?? null}
      initialCompletions={completions}
      initialSelfieUploaded={Boolean(existingSelfie)}
    />
  )
}
