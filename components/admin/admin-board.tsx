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
import { createExercise, createTeam, updateExerciseVideo } from "@/app/admin/actions"
import { ProgramGenerator } from "@/components/admin/program-generator"
import { AthletesPanel } from "@/components/admin/athletes-panel"
import { AthleteCreateForm } from "@/components/admin/athlete-create-form"
import { ProgramReviewPanel } from "@/components/admin/program-review-panel"
import { AIProgramGenerator } from "@/components/admin/ai-program-generator"
import { AthleteFeedbackPanel, type AthleteSessionSummary, type AthleteExercisePain } from "@/components/admin/athlete-feedback-panel"

type Props = { teams: any[]; sessions: any[]; athletes: any[]; exercises: any[]; selfies: any[]; notifications: any[]; rules: any[]; programs: any[]; feedbackSummaries?: AthleteSessionSummary[]; feedbackPainReports?: AthleteExercisePain[] }

export function AdminBoard({ teams = [], sessions = [], athletes = [], exercises = [], selfies = [], rules = [], programs = [], feedbackSummaries = [], feedbackPainReports = [] }: Props) {
  const [tab, setTab] = useState("sessions")
  const safeTeams = Array.isArray(teams) ? teams : []
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const safeAthletes = Array.isArray(athletes) ? athletes : []
  const safeExercises = Array.isArray(exercises) ? exercises : []
  const safeRules = Array.isArray(rules) ? rules : []

  useEffect(() => {
    // [athlete-debug] logs commented out for production
    // console.groupCollapsed("[athlete-debug] Admin roster received in browser")
    // console.log("Roster counts", { athletes: safeAthletes.length, ... })
    // console.groupEnd()
  }, [programs, safeAthletes, safeSessions, safeTeams])

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
      <header>
        <p className="text-sm text-muted-foreground">Admin workspace</p>
        <h1 className="text-3xl font-bold">Coach operations</h1>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-6 gap-1 overflow-hidden p-1">
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="athletes">Athletes</TabsTrigger>
          <TabsTrigger value="feedback">
            Feedback
            {feedbackPainReports.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {feedbackPainReports.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
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

function AthletesWorkspace({ teams, athletes, selfies, feedbackSummaries, feedbackPainReports }: { teams: any[]; athletes: any[]; selfies: any[]; feedbackSummaries: any[]; feedbackPainReports: any[] }) {
  const [showCreate, setShowCreate] = useState(false)
  return <div className="grid gap-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">Athletes</h2><p className="text-sm text-muted-foreground">{athletes.length} athlete{athletes.length === 1 ? "" : "s"} in your roster</p></div><Button type="button" onClick={() => setShowCreate((value) => !value)}><Plus className="mr-2 size-4" />{showCreate ? "Close form" : "Create athlete"}</Button></div>{showCreate ? <AthleteCreateForm teams={teams} /> : null}<TeamManagementForm /><AthletesPanel athletes={athletes} selfies={selfies} feedbackSummaries={feedbackSummaries} feedbackPainReports={feedbackPainReports} /></div>
}

function TeamManagementForm() {
  const [open, setOpen] = useState(false)
  return <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle>Teams</CardTitle><p className="mt-1 text-sm text-muted-foreground">Create teams with branding, colors, and a team photo.</p></div><Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>{open ? "Close" : "Add team"}</Button></CardHeader>{open ? <CardContent><form action={async (formData) => { await createTeam(formData) }} className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="team-name-en">Team name</Label><Input id="team-name-en" name="name_en" required placeholder="e.g. First Team" /></div><div className="grid gap-2"><Label htmlFor="team-name-ar">Arabic name</Label><Input id="team-name-ar" name="name_ar" placeholder="اسم الفريق" /></div><div className="grid gap-2"><Label htmlFor="team-image">Team photo URL</Label><Input id="team-image" name="image_url" type="url" placeholder="https://..." /></div><div className="grid gap-2"><Label htmlFor="team-color">Team color</Label><Input id="team-color" name="color_hex" type="color" defaultValue="#2563eb" className="h-10 p-1" /></div><div className="flex items-center gap-2"><input id="team-national" name="is_national_team" type="checkbox" value="true" /><Label htmlFor="team-national">National team</Label></div><div className="flex items-end sm:justify-end"><Button type="submit">Create team</Button></div></form></CardContent> : null}</Card>
}

function ProgramsWorkspace({ athletes, exercises, rules, programs }: { athletes: any[]; exercises: any[]; rules: any[]; programs: any[] }) {
  const [mode, setMode] = useState<"rules" | "ai">("rules")
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("rules")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${mode === "rules" ? "border-accent bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
        >
          Rules-based
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${mode === "ai" ? "border-violet-500 bg-violet-500/10 text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
        >
          ✨ AI (Gemini)
        </button>
      </div>
      {mode === "rules" ? (
        <ProgramGenerator athletes={athletes} exercises={exercises} rules={rules} />
      ) : (
        <AIProgramGenerator athletes={athletes} />
      )}
      <ProgramReviewPanel programs={programs} />
    </div>
  )
}

function ExercisePanel({ exercises }: { exercises: any[] }) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>Add exercise</CardTitle></CardHeader>
        <CardContent>
          <form action={async (formData) => { await createExercise(formData) }} className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="new-exercise-en">Name</Label><Input id="new-exercise-en" name="name_en" required /></div>
            <div className="grid gap-2"><Label htmlFor="new-exercise-ar">Arabic name</Label><Input id="new-exercise-ar" name="name_ar" /></div>
            <div className="grid gap-2"><Label htmlFor="new-exercise-category">Category</Label><Input id="new-exercise-category" name="category" /></div>
            <div className="grid gap-2"><Label htmlFor="new-exercise-image">Image URL</Label><Input id="new-exercise-image" name="image_url" /></div>
            <div className="grid gap-2"><Label htmlFor="new-exercise-youtube">YouTube URL</Label><Input id="new-exercise-youtube" name="video_youtube_url" /></div>
            <div className="flex items-end"><Button type="submit">Add exercise</Button></div>
          </form>
        </CardContent>
      </Card>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Exercise catalog">
        {exercises.map((exercise) => <Card key={exercise.id} className="overflow-hidden"><CardHeader><CardTitle className="text-base">{exercise.name_en}</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">{exercise.category || "Uncategorized"}</p>{exercise.image_url ? <img src={exercise.image_url} alt={`${exercise.name_en} exercise`} className="aspect-video w-full rounded-lg object-cover" /> : <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">No photo</div>}{exercise.video_youtube_url ? <div className="aspect-video overflow-hidden rounded-lg"><iframe title={`${exercise.name_en} video`} src={exercise.video_youtube_url.replace("watch?v=", "embed/").split("&")[0]} className="h-full w-full" allowFullScreen /></div> : <p className="text-xs text-muted-foreground">No video</p>}<form action={async (formData) => { await updateExerciseVideo(formData) }} className="grid gap-2 border-t pt-3"><input type="hidden" name="exercise_id" value={exercise.id} /><Label htmlFor={`youtube-${exercise.id}`}>YouTube link</Label><div className="flex gap-2"><Input id={`youtube-${exercise.id}`} name="video_youtube_url" type="url" placeholder="https://www.youtube.com/watch?v=..." defaultValue={exercise.video_youtube_url ?? ""} /><Button type="submit" variant="outline">Save video</Button></div></form></CardContent></Card>)}
      </section>
    </div>
  )
}
