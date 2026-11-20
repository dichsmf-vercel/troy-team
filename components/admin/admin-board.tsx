"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { SessionPanel } from "@/components/admin/session-panel"
import { RulesPanel } from "@/components/admin/rules-panel"
import { createExercise, updateExerciseVideo } from "@/app/admin/actions/exercises"
import { createTeam } from "@/app/admin/actions/teams-sessions"
import { ProgramGenerator } from "@/components/admin/program-generator"
import { AthletesPanel, AthleteStats } from "@/components/admin/athletes-panel"
import { AthleteCreateForm } from "@/components/admin/athlete-create-form"
import { ProgramReviewPanel } from "@/components/admin/program-review-panel"
import { AIProgramGenerator } from "@/components/admin/ai-program-generator"
import { PromptProposalsPanel } from "@/components/admin/prompt-proposals-panel"
import type { AdminAthlete, AdminExercise, AdminNotification, AdminProgram, AdminRule, AdminSelfie, AdminSession, AdminTeam } from "@/lib/admin/types"
import { AthleteFeedbackPanel, type AthleteSessionSummary, type AthleteExercisePain } from "@/components/admin/athlete-feedback-panel"
import { useT, useLn } from "@/components/providers/language-provider"
import { resolveExerciseMedia, youtubeEmbedUrl } from "@/lib/exercise-media"

/** What athletes see for this exercise: the coach's own photo/video, else the built-in library. */
const mediaOf = (exercise: AdminExercise) =>
  resolveExerciseMedia({ name: exercise.name_en, code: exercise.exercise_code, image_url: exercise.image_url, video_youtube_url: exercise.video_youtube_url })

type Props = { teams: AdminTeam[]; sessions: AdminSession[]; athletes: AdminAthlete[]; exercises: AdminExercise[]; selfies: AdminSelfie[]; notifications: AdminNotification[]; rules: AdminRule[]; programs: AdminProgram[]; feedbackSummaries?: AthleteSessionSummary[]; feedbackPainReports?: AthleteExercisePain[] }

export function AdminBoard({ teams = [], sessions = [], athletes = [], exercises = [], selfies = [], rules = [], programs = [], feedbackSummaries = [], feedbackPainReports = [] }: Props) {
  const t = useT()
  const ln = useLn()
  const [tab, setTab] = useState("sessions")
  const safeTeams = Array.isArray(teams) ? teams : []
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const safeAthletes = Array.isArray(athletes) ? athletes : []
  const safeExercises = Array.isArray(exercises) ? exercises : []
  const safeRules = Array.isArray(rules) ? rules : []

  useEffect(() => {
    // [athlete-debug] logs commented out for production
    // console.groupCollapsed("[athlete-debug] Admin roster received in browser")
    // console.groupEnd()
  }, [programs, safeAthletes, safeSessions, safeTeams])

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
      <header>
        <p className="text-sm text-muted-foreground">{t("Admin workspace")}</p>
        <h1 className="text-3xl font-bold">{t("Coach operations")}</h1>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-6 gap-1 overflow-hidden p-1">
          <TabsTrigger value="sessions" data-tour="tab-sessions">{t("Sessions")}</TabsTrigger>
          <TabsTrigger value="athletes" data-tour="tab-athletes">{t("Athletes")}</TabsTrigger>
          <TabsTrigger value="feedback" data-tour="tab-feedback">
            {t("Feedback")}
            {feedbackPainReports.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {feedbackPainReports.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="exercises" data-tour="tab-exercises">{t("Exercises")}</TabsTrigger>
          <TabsTrigger value="rules" data-tour="tab-rules">{t("Rules")}</TabsTrigger>
          <TabsTrigger value="programs" data-tour="tab-programs">{t("Programs")}</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-6">
          <SessionPanel teams={safeTeams} athletes={safeAthletes} sessions={safeSessions} exercises={safeExercises} />
        </TabsContent>
        <TabsContent value="athletes" className="mt-6">
          <AthletesWorkspace teams={safeTeams} athletes={safeAthletes} selfies={Array.isArray(selfies) ? selfies : []} feedbackSummaries={feedbackSummaries} feedbackPainReports={feedbackPainReports} />
        </TabsContent>
        <TabsContent value="feedback" className="mt-6">
          <AthleteFeedbackPanel athletes={safeAthletes} summaries={feedbackSummaries} painReports={feedbackPainReports} />
        </TabsContent>
        <TabsContent value="exercises" className="mt-6">
          <ExercisePanel exercises={safeExercises} />
        </TabsContent>
        <TabsContent value="rules" className="mt-6">
          <RulesPanel rules={safeRules} exercises={safeExercises} />
        </TabsContent>
        <TabsContent value="programs" className="mt-6">
          <ProgramsWorkspace athletes={safeAthletes} exercises={safeExercises} rules={safeRules} programs={programs} />
        </TabsContent>
      </Tabs>
    </main>
  )
}

function AthletesWorkspace({ teams, athletes, selfies, feedbackSummaries, feedbackPainReports }: { teams: AdminTeam[]; athletes: AdminAthlete[]; selfies: AdminSelfie[]; feedbackSummaries: AthleteSessionSummary[]; feedbackPainReports: AthleteExercisePain[] }) {
  const t = useT()
  const ln = useLn()
  const [showCreate, setShowCreate] = useState(false)
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("Athletes")}</h2>
          <p className="text-sm text-muted-foreground">{t.plural(athletes.length, "{count} athlete in your roster", "{count} athletes in your roster")}</p>
        </div>
        <Button type="button" onClick={() => setShowCreate((value) => !value)}>
          <Plus className="mr-2 size-4" />{showCreate ? t("Close form") : t("Create athlete")}
        </Button>
      </div>
      <AthleteStats athletes={athletes} />
      {showCreate ? <AthleteCreateForm teams={teams} /> : null}
      <TeamManagementForm />
      <AthletesPanel athletes={athletes} selfies={selfies} feedbackSummaries={feedbackSummaries} feedbackPainReports={feedbackPainReports} />
    </div>
  )
}

function TeamManagementForm() {
  const t = useT()
  const ln = useLn()
  const [open, setOpen] = useState(false)
  const [teamMessage, setTeamMessage] = useState<string | null>(null)
  return <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle>{t("Teams")}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{t("Create teams with branding, colors, and a team photo.")}</p></div><Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>{open ? t("Close") : t("Add team")}</Button></CardHeader>{open ? <CardContent><form action={async (formData) => { const result = await createTeam(formData); setTeamMessage(result.error ?? t("Team created.")) }} className="grid gap-4 sm:grid-cols-2">{teamMessage ? <p role="status" className="text-sm text-muted-foreground sm:col-span-2">{teamMessage}</p> : null}<div className="grid gap-2"><Label htmlFor="team-name-en">{t("Team name")}</Label><Input id="team-name-en" name="name_en" required placeholder={t("e.g. First Team")} /></div><div className="grid gap-2"><Label htmlFor="team-name-ar">{t("Arabic name")}</Label><Input id="team-name-ar" name="name_ar" placeholder="اسم الفريق" /></div><div className="grid gap-2"><Label htmlFor="team-image">{t("Team photo URL")}</Label><Input id="team-image" name="image_url" type="url" placeholder={t("https://...")} /></div><div className="grid gap-2"><Label htmlFor="team-color">{t("Team color")}</Label><Input id="team-color" name="color_hex" type="color" defaultValue="#2563eb" className="h-10 p-1" /></div><div className="flex items-center gap-2"><input id="team-national" name="is_national_team" type="checkbox" value="true" /><Label htmlFor="team-national">{t("National team")}</Label></div><div className="flex items-end sm:justify-end"><Button type="submit">{t("Create team")}</Button></div></form></CardContent> : null}</Card>
}

function ProgramsWorkspace({ athletes, exercises, rules, programs }: { athletes: AdminAthlete[]; exercises: AdminExercise[]; rules: AdminRule[]; programs: AdminProgram[] }) {
  const t = useT()
  const ln = useLn()
  const [mode, setMode] = useState<"rules" | "ai">("rules")
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("rules")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${mode === "rules" ? "border-accent bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
        >
          {t("Rules-based")}
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${mode === "ai" ? "border-violet-500 bg-violet-500/10 text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
        >
          {t("✨ AI (Gemini)")}
        </button>
      </div>
      {mode === "rules" ? (
        <ProgramGenerator athletes={athletes} exercises={exercises} rules={rules} />
      ) : (
        <>
          <AIProgramGenerator athletes={athletes} exercises={exercises} />
          <PromptProposalsPanel />
        </>
      )}
      <ProgramReviewPanel programs={programs} />
    </div>
  )
}

function ExercisePanel({ exercises }: { exercises: AdminExercise[] }) {
  const t = useT()
  const ln = useLn()
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>{t("Add exercise")}</CardTitle></CardHeader>
        <CardContent>
          <form action={async (formData) => { await createExercise(formData) }} className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="new-exercise-en">{t("Name")}</Label><Input id="new-exercise-en" name="name_en" required /></div>
            <div className="grid gap-2"><Label htmlFor="new-exercise-ar">{t("Arabic name")}</Label><Input id="new-exercise-ar" name="name_ar" /></div>
            <div className="grid gap-2"><Label htmlFor="new-exercise-category">{t("Category")}</Label><Input id="new-exercise-category" name="category" /></div>
            <div className="grid gap-2"><Label htmlFor="new-exercise-image">{t("Image URL")}</Label><Input id="new-exercise-image" name="image_url" /></div>
            <div className="grid gap-2"><Label htmlFor="new-exercise-youtube">{t("YouTube URL")}</Label><Input id="new-exercise-youtube" name="video_youtube_url" /></div>
            <div className="flex items-end"><Button type="submit">{t("Add exercise")}</Button></div>
          </form>
        </CardContent>
      </Card>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("Exercise catalog")}>
        {exercises.map((exercise) => <Card key={exercise.id} className="overflow-hidden"><CardHeader><CardTitle className="text-base">{ln(exercise.name_en, exercise.name_ar)}</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">{exercise.category || t("Uncategorized")}</p>{mediaOf(exercise).images[0] ? <img src={mediaOf(exercise).images[0]} alt={t("{name_en} exercise", { name_en: exercise.name_en })} className="aspect-video w-full rounded-lg object-cover" /> : <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">{t("No photo")}</div>}{youtubeEmbedUrl(mediaOf(exercise).videoUrl) ? <div className="aspect-video overflow-hidden rounded-lg"><iframe title={t("{name_en} video", { name_en: exercise.name_en })} src={youtubeEmbedUrl(mediaOf(exercise).videoUrl) ?? undefined} className="h-full w-full" allowFullScreen /></div> : <p className="text-xs text-muted-foreground">{t("No video")}</p>}<form action={async (formData) => { await updateExerciseVideo(formData) }} className="grid gap-2 border-t pt-3"><input type="hidden" name="exercise_id" value={exercise.id} /><Label htmlFor={`youtube-${exercise.id}`}>{t("YouTube link")}</Label><div className="flex gap-2"><Input id={`youtube-${exercise.id}`} name="video_youtube_url" type="url" placeholder={t("https://www.youtube.com/watch?v=...")} defaultValue={exercise.video_youtube_url ?? ""} /><Button type="submit" variant="outline">{t("Save video")}</Button></div></form></CardContent></Card>)}
      </section>
    </div>
  )
}
