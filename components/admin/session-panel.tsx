"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { createSessionPost } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = { teams: any[]; athletes: any[]; sessions: any[]; exercises: any[] }

export function SessionPanel({ teams, athletes, sessions, exercises }: Props) {
  const [targetType, setTargetType] = useState<"team" | "athlete">("team")
  const [targets, setTargets] = useState([{ id: "", load: "" }])
  const [exerciseRows, setExerciseRows] = useState([{ id: "", sets: "3", reps: "10" }])
  const options = targetType === "team" ? teams : athletes
  const targetLabel = targetType === "team" ? "Team" : "Athlete"
  return <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-5" />Create session</CardTitle></CardHeader><CardContent><form action={createSessionPost} className="flex flex-col gap-4">
      <div className="grid gap-2"><Label htmlFor="session-title">Session title</Label><Input id="session-title" name="title_en" required /></div>
      <div className="grid gap-2"><Label htmlFor="session-date">Date</Label><Input id="session-date" name="session_date" type="date" required /></div>
      <div className="grid gap-2"><Label htmlFor="session-start">Start time</Label><Input id="session-start" name="start_time" type="datetime-local" required /></div>
      <div className="grid gap-2"><Label htmlFor="target-type">Assign to</Label><select id="target-type" name="target_type" value={targetType} onChange={(event) => { setTargetType(event.target.value as "team" | "athlete"); setTargets([{ id: "", load: "" }]) }} className="h-10 rounded-sm border bg-background px-3 text-sm"><option value="team">Team</option><option value="athlete">Individual athletes</option></select></div>
      <div className="grid gap-3"><Label>{targetLabel} assignments and load percentages</Label>{targets.map((target, index) => <div className="grid grid-cols-[1fr_88px_auto] gap-2" key={index}><select name="target_id" value={target.id} onChange={(event) => setTargets(targets.map((current, currentIndex) => currentIndex === index ? { ...current, id: event.target.value } : current))} required className="h-10 min-w-0 rounded-sm border bg-background px-3 text-sm"><option value="">Choose {targetLabel.toLowerCase()}</option>{options.map((option: any) => <option key={option.id} value={option.id}>{targetType === "team" ? option.name_en : option.profiles?.full_name || option.id}</option>)}</select><Input name={target.id ? `load_percentage_${target.id}` : undefined} value={target.load} onChange={(event) => setTargets(targets.map((current, currentIndex) => currentIndex === index ? { ...current, load: event.target.value } : current))} type="number" min="0" max="200" placeholder="Load %" aria-label={`${targetLabel} load percentage`} /><Button type="button" variant="outline" onClick={() => setTargets(targets.filter((_, currentIndex) => currentIndex !== index))}>×</Button></div>)}<Button type="button" variant="outline" onClick={() => setTargets([...targets, { id: "", load: "" }])}>Add {targetLabel.toLowerCase()}</Button></div>
      <div className="grid gap-3"><Label>Exercises, sets, and reps</Label>{exerciseRows.map((row, index) => <div className="grid grid-cols-[1fr_60px_70px_auto] gap-2" key={index}><select name="exercise_id" value={row.id} onChange={(event) => setExerciseRows(exerciseRows.map((current, currentIndex) => currentIndex === index ? { ...current, id: event.target.value } : current))} required className="h-10 min-w-0 rounded-sm border bg-background px-2 text-sm"><option value="">Exercise</option>{exercises.map((exercise: any) => <option key={exercise.id} value={exercise.id}>{exercise.name_en}</option>)}</select><Input name="exercise_sets" value={row.sets} onChange={(event) => setExerciseRows(exerciseRows.map((current, currentIndex) => currentIndex === index ? { ...current, sets: event.target.value } : current))} type="number" min="1" placeholder="Sets" aria-label="Sets" /><Input name="exercise_reps" value={row.reps} onChange={(event) => setExerciseRows(exerciseRows.map((current, currentIndex) => currentIndex === index ? { ...current, reps: event.target.value } : current))} placeholder="Reps" aria-label="Reps" /><Button type="button" variant="outline" onClick={() => setExerciseRows(exerciseRows.filter((_, currentIndex) => currentIndex !== index))}>×</Button></div>)}<Button type="button" variant="outline" onClick={() => setExerciseRows([...exerciseRows, { id: "", sets: "3", reps: "10" }])}>Add exercise</Button></div>
      <div className="grid gap-2"><Label htmlFor="session-notes">Notes</Label><textarea id="session-notes" name="notes_en" rows={3} className="rounded-sm border bg-background px-3 py-2 text-sm" /></div><Button type="submit">Save session</Button>
    </form></CardContent></Card>
    <div className="flex flex-col gap-3">{sessions.map((session) => <Card key={session.id}><CardContent className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">{session.title_en}</p><p className="text-sm text-muted-foreground">{session.session_date} · {session.start_time ? new Date(session.start_time).toLocaleString() : "No start time"}</p></div></CardContent></Card>)}</div>
  </div>
}
