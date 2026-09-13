"use client"

import { useMemo, useState } from "react"
import { CalendarDays, Clock3, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { generateFourWeekProgram, monthLabel, weekdayLabel } from "@/lib/program-engine"

const weekdays = [0, 1, 2, 3, 4, 5, 6]
export function ProgramGenerator({ athletes, exercises }: { athletes: any[]; exercises: any[] }) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState("18:00")
  const [days, setDays] = useState<number[]>([1, 3, 5])
  const [generated, setGenerated] = useState<ReturnType<typeof generateFourWeekProgram>>([])
  const selectedAthlete = athletes.find((athlete) => athlete.id === athleteId)
  const month = useMemo(() => monthLabel(startDate), [startDate])
  return <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-accent" />Generate four weeks</CardTitle></CardHeader><CardContent className="grid gap-4">
      <div className="grid gap-2"><Label htmlFor="program-athlete">Athlete</Label><select id="program-athlete" value={athleteId} onChange={(event) => setAthleteId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.profiles?.full_name ?? athlete.full_name ?? athlete.id}</option>)}</select></div>
      <div className="grid gap-2"><Label htmlFor="program-start">Month start</Label><Input id="program-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
      <div className="grid gap-2"><Label htmlFor="program-time">Training time</Label><div className="relative"><Clock3 className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="program-time" className="pl-9" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></div></div>
      <fieldset className="grid gap-2"><legend className="text-sm font-medium">Exact training days</legend><div className="grid grid-cols-4 gap-2">{weekdays.map((day) => <label key={day} className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs ${days.includes(day) ? "border-accent bg-accent/10 text-foreground" : "text-muted-foreground"}`}><input className="sr-only" type="checkbox" checked={days.includes(day)} onChange={() => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])} />{weekdayLabel(day)}</label>)}</div></fieldset>
      <Button type="button" disabled={!athleteId || !days.length} onClick={() => setGenerated(generateFourWeekProgram({ startDate, time, weekdays: days, exercises }))}>Preview program</Button>
      <p className="text-xs leading-relaxed text-muted-foreground">Rest days stay empty. Missing measurements skip dependent rules; loads remain blank when no max is recorded.</p>
    </CardContent></Card>
    <div className="grid gap-4"><div className="flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">{selectedAthlete?.profiles?.full_name ?? "Select an athlete"}</p><h2 className="text-2xl font-semibold">{month}</h2></div><CalendarDays className="size-7 text-accent" /></div>{generated.length === 0 ? <Card><CardContent className="flex min-h-64 items-center justify-center p-6 text-center text-sm text-muted-foreground">Preview the month to see scheduled sessions, progression, and safety flags.</CardContent></Card> : <div className="grid gap-3">{generated.map((session) => <Card key={session.date} className="overflow-hidden"><CardContent className="grid gap-3 p-4 sm:grid-cols-[120px_1fr_auto] sm:items-center"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Week {session.week}</p><p className="font-semibold">{new Date(`${session.date}T12:00:00`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</p><p className="text-sm text-muted-foreground">{session.time}</p></div><div className="flex flex-wrap gap-2">{session.exercises.map((exercise) => <span key={`${session.date}-${exercise.id}-${exercise.section}`} className="rounded-full bg-muted px-2.5 py-1 text-xs">{exercise.section}: {exercise.name_en}{exercise.loadPercentage ? ` · ${exercise.loadPercentage}%` : ""}</span>)}</div>{session.tooFewExercises ? <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">Too few exercises</span> : <span className="text-xs text-muted-foreground">Draft</span>}</CardContent></Card>)}</div>}</div>
  </div>
}
