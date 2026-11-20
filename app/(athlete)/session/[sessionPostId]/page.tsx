import { loadAthleteToggles } from "@/lib/athlete-settings"
import { redirect } from "next/navigation"
import { firstRelation } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLanguage, getT } from "@/lib/i18n/get-language"
import { SessionRunner } from "@/components/session/session-runner"
import { exerciseDisplayName, resolveExerciseMedia } from "@/lib/exercise-media"

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionPostId: string }>
}) {
  const t = await getT()
  const { sessionPostId } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect("/auth/login")

  const language = await getLanguage()

  // The dashboard already proved the authenticated athlete can see this assignment.
  // Use the server-only client for the assignment data to avoid a second RLS lookup
  // turning a valid handoff into Next's generic 404 page.
  const assignedDataClient = createAdminClient()
  const { data: post, error: postError } = await assignedDataClient
    .from("session_posts")
    .select("id, title_en, title_ar, notes, session_date, start_time, team_id, athlete_id")
    .eq("id", sessionPostId)
    .maybeSingle()
  const { data: team } = post?.team_id
    ? await assignedDataClient.from("teams").select("name_en, name_ar, color_hex, is_national_team").eq("id", post.team_id).maybeSingle()
    : { data: null }

  const { data: sessionAthlete, error: sessionAthleteError } = await supabase.from("session_athletes").select("id, attended_at").eq("session_post_id", sessionPostId).eq("athlete_id", userData.user.id).maybeSingle()
  const toggles = await loadAthleteToggles(supabase, userData.user.id)
  // [assigned-session-debug] logs commented out for production
  if (!post) {
    console.error("[assigned-session-debug] Session post missing after navigation", { sessionPostId, athleteId: userData.user.id, postError: postError?.message ?? null })
    return <main className="mx-auto max-w-xl p-6"><div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6"><h1 className="text-xl font-semibold">{t("This assigned training is unavailable")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("The training could not be loaded. Return to the dashboard and try again.")}</p><a href="/dashboard" className="mt-4 inline-flex text-sm font-medium text-primary underline">{t("Back to dashboard")}</a></div></main>
  }
  // Dashboard already derives this card from the athlete's assigned sessions. Do not
  // repeat the team-membership check here: it can reject valid assigned sessions when
  // an athlete_teams row is missing while the session post itself is visible.

  const { data: exercises, error: exercisesError } = await assignedDataClient
    .from("session_exercises")
    .select("id, exercise_id, exercise_order, sets, reps, exercises(id, name_en, name_ar, description_en, description_ar, image_url, video_youtube_url)")
    .eq("session_post_id", sessionPostId)
    .order("exercise_order", { ascending: true })
  const resolvedExercises = (exercises ?? []).filter((row) => Boolean(firstRelation(row.exercises)?.id))
  // [assigned-session-debug] exercise resolution logs commented out for production
  if (exercisesError) {
    // log silently to server stderr in production
  }

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
      notes={post.notes ?? null}
      teamName={team ? (language === "ar" ? team.name_ar : team.name_en) : ""}
      teamColor={team?.color_hex ?? "#94A3B8"}
      isNationalTeam={team?.is_national_team ?? false}
      sessionDate={post.session_date}
      period={post.start_time ? String(post.start_time).slice(0, 5) : "00:00"}
      exercises={(exercises ?? []).flatMap((se) => {
        const related = Array.isArray(se.exercises) ? se.exercises[0] : se.exercises
        if (!related?.id) return []
        const media = resolveExerciseMedia({ name: related.name_en, image_url: related.image_url, video_youtube_url: related.video_youtube_url })
        return [{
          sessionExerciseId: se.id,
          exerciseId: related.id,
          name: exerciseDisplayName(related.name_en, related.name_ar, language),
          description: language === "ar" ? related.description_ar : related.description_en,
          imageUrl: media.images[0] ?? null,
          images: media.images,
          videoUrl: media.videoUrl,
          sets: se.sets,
          reps: se.reps,
        }]
      })}
      initialSessionAthleteId={sessionAthlete?.id ?? null}
      initialAttendedAt={sessionAthlete?.attended_at ?? null}
      initialCompletions={completions}
      initialSelfieUploaded={false}
      selfieRequired={toggles.selfieRequired}
    />
  )
}
