"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { SessionPanel } from "@/components/admin/session-panel"
import { RulesPanel } from "@/components/admin/rules-panel"
import { createExercise } from "@/app/admin/actions"
import { ProgramGenerator } from "@/components/admin/program-generator"
import { AthletesPanel } from "@/components/admin/athletes-panel"
import { ProgramReviewPanel } from "@/components/admin/program-review-panel"

type Props = { teams: any[]; sessions: any[]; athletes: any[]; exercises: any[]; selfies: any[]; notifications: any[]; rules: any[]; programs: any[] }

export function AdminBoard({ teams = [], sessions = [], athletes = [], exercises = [], rules = [], programs = [] }: Props) {
  const [tab, setTab] = useState("sessions")
  const safeTeams = Array.isArray(teams) ? teams : []
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const safeAthletes = Array.isArray(athletes) ? athletes : []
  const safeExercises = Array.isArray(exercises) ? exercises : []
  const safeRules = Array.isArray(rules) ? rules : []

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
      <header>
        <p className="text-sm text-muted-foreground">Admin workspace</p>
        <h1 className="text-3xl font-bold">Coach operations</h1>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-5 gap-1 overflow-hidden p-1">
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="athletes">Athletes</TabsTrigger>
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-6">
          <SessionPanel teams={safeTeams} athletes={safeAthletes} sessions={safeSessions} exercises={safeExercises} />
        </TabsContent>
        <TabsContent value="athletes" className="mt-6">
          <AthletesPanel athletes={safeAthletes} />
        </TabsContent>
        <TabsContent value="exercises" className="mt-6">
          <ExercisePanel exercises={safeExercises} />
        </TabsContent>
        <TabsContent value="rules" className="mt-6">
          <RulesPanel rules={safeRules} exercises={safeExercises} />
        </TabsContent>
        <TabsContent value="programs" className="mt-6">
          <div className="grid gap-6"><ProgramGenerator athletes={safeAthletes} exercises={safeExercises} /><ProgramReviewPanel programs={programs} /></div>
        </TabsContent>
      </Tabs>
    </main>
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
        {exercises.map((exercise) => <Card key={exercise.id}><CardHeader><CardTitle className="text-base">{exercise.name_en}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{exercise.category || "Uncategorized"}</p></CardContent></Card>)}
      </section>
    </div>
  )
}
