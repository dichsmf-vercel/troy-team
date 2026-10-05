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

  const { data: post, error: postError } = await supabase
    .from("session_posts")
    .select("id, title_en, title_ar, notes, notes_en, notes_ar, session_date, start_time, period, team_id, athlete_id")
    .eq("id", sessionPostId)
    .maybeSingle()
  const { data: team } = post?.team_id
    ? await supabase.from("teams").select("name_en, name_ar, color_hex, is_national_team").eq("id", post.team_id).maybeSingle()
    : { data: null }

  const { data: sessionAthlete, error: sessionAthleteError } = await supabase.from("session_athletes").select("id, attended_at").eq("session_post_id", sessionPostId).eq("athlete_id", userData.user.id).maybeSingle()
  console.log("[assigned-session-debug] Session page handoff", {
    sessionPostId,
    athleteId: userData.user.id,
    postFound: Boolean(post),
    postError: postError?.message ?? null,
    postAthleteId: post?.athlete_id ?? null,
    teamId: post?.team_id ?? null,
    sessionAthleteId: sessionAthlete?.id ?? null,
    sessionAthleteError: sessionAthleteError?.message ?? null,
    route: `/session/${sessionPostId}`,
  })
  if (!post) notFound()
  // Dashboard already derives this card from the athlete's assigned sessions. Do not
  // repeat the team-membership check here: it can reject valid assigned sessions when
  // an athlete_teams row is missing while the session post itself is visible.

  const { data: exercises, error: exercisesError } = await supabase
    .from("session_exercises")
    .select("id, exercise_id, exercise_order, sets, reps, exercises(id, name_en, name_ar, description_en, description_ar, image_url, video_youtube_url)")
    .eq("session_post_id", sessionPostId)
    .order("exercise_order", { ascending: true })
  const resolvedExercises = (exercises ?? []).filter((row: any) => Boolean(row.exercises?.id))
  console.log("[assigned-session-debug] Session page resolution", {
    sessionPostId,
    athleteId: userData.user.id,
    postFound: Boolean(post),
    sessionAthleteId: sessionAthlete?.id ?? null,
    rawExerciseRowCount: exercises?.length ?? 0,
    linkedExerciseCount: resolvedExercises.length,
    exerciseError: exercisesError?.message ?? null,
    exerciseIds: (exercises ?? []).map((row: any) => row.exercise_id),
    unresolvedRows: (exercises ?? []).filter((row: any) => !row.exercises?.id).map((row: any) => ({ id: row.id, exerciseId: row.exercise_id })),
    checks: {
      postLoaded: Boolean(post),
      exerciseQuerySucceeded: !exercisesError,
      hasExerciseRows: Boolean(exercises?.length),
      allRowsLinked: resolvedExercises.length === (exercises?.length ?? 0),
    },
  })
  if (exercisesError) console.error("[assigned-session-debug] Session exercise query failed", exercisesError)
  if (!exercises?.length) console.warn("[assigned-session-debug] No session_exercises rows resolved for this session post")

  const { data: existingSelfie } = sessionAthlete?.id ? await supabase.from("session_selfies").select("id").eq("session_athlete_id", sessionAthlete.id).maybeSingle() : { data: null }

  let completions: { session_exercise_id: string; completed: boolean }[] = []
  if (sessionAthlete?.id) {
    const { data } = await supabase
      .from("exercise_completions")
      .select("session_exercise_id, completed")
      .eq("session_athlete_id", sessionAthlete.id)
    completions = data ?? []
  }

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
      exercises={(exercises ?? []).flatMap((se: any) => {
        const related = Array.isArray(se.exercises) ? se.exercises[0] : se.exercises
        if (!related?.id) return []
        return [{
          sessionExerciseId: se.id,
          exerciseId: related.id,
          name: language === "ar" ? related.name_ar : related.name_en,
          description: language === "ar" ? related.description_ar : related.description_en,
          imageUrl: related.image_url,
          videoUrl: related.video_youtube_url,
          sets: se.sets,
          reps: se.reps,
        }]
      })}
      initialSessionAthleteId={sessionAthlete?.id ?? null}
      initialAttendedAt={sessionAthlete?.attended_at ?? null}
      initialCompletions={completions}
      initialSelfieUploaded={Boolean(existingSelfie)}
    />
  )
}
