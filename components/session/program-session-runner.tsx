"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { completeProgramSession } from "@/app/(athlete)/program/session/actions"

export function ProgramSessionRunner({ programId, date, time, exercises, initialFeedback, initialCompleted = false }: { programId: string; date: string; time: string; exercises: any[]; initialFeedback: any[]; initialCompleted?: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [completed, setCompleted] = useState<number[]>(initialCompleted ? exercises.map((_, index) => index) : [])
  const [difficulty, setDifficulty] = useState(3)
  const [painNotes, setPainNotes] = useState("")
  const [enjoyment, setEnjoyment] = useState(3)
  const [finished, setFinished] = useState(initialCompleted)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const active = exercises[activeIndex]
  const allDone = exercises.length > 0 && completed.length === exercises.length
  function finishSession() { startTransition(async () => { const result = await completeProgramSession({ programId, date, difficulty, painNotes, enjoyment }); if (result.error) setError(result.error); else setFinished(true) }) }
  if (!exercises.length) return <Card className="p-6 text-center"><p className="font-medium">No exercises scheduled</p><Link className="mt-4 inline-flex text-sm text-primary underline" href="/program">Back to program</Link></Card>
  if (finished) return <Card className="grid gap-4 p-6 text-center"><div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><Check /></div><h1 className="text-xl font-semibold">Session completed</h1><p className="text-sm text-muted-foreground">This session is marked done and attended in your calendar.</p><Link href="/dashboard" className="text-sm text-primary underline">Back to Home</Link></Card>
  return <div className="mx-auto grid max-w-xl gap-5"><div><p className="text-xs text-muted-foreground">{date} · {time}</p><h1 className="mt-1 text-2xl font-semibold">Program training</h1><p className="mt-1 text-sm text-muted-foreground">Exercise {activeIndex + 1} of {exercises.length}</p></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(completed.length / exercises.length) * 100}%` }} /></div><Card className="grid gap-4 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{active.section ?? "Training"}</p><h2 className="text-xl font-semibold">{active.name_en ?? active.name ?? "Exercise"}</h2><p className="text-sm text-muted-foreground">{active.sets ?? "-"} sets · {active.reps ?? "-"} reps</p>{active.image_url ? <img src={active.image_url} alt={active.name_en ?? "Exercise"} className="aspect-video w-full rounded-lg object-cover" /> : null}{active.video_youtube_url ? <a href={active.video_youtube_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Watch exercise video</a> : null}<Button onClick={() => { setCompleted((current) => current.includes(activeIndex) ? current : [...current, activeIndex]); if (activeIndex < exercises.length - 1) setActiveIndex((index) => index + 1) }} disabled={pending}>{activeIndex === exercises.length - 1 ? "Mark exercise complete" : "Complete exercise and continue"}</Button></Card>{allDone ? <Card className="grid gap-3 p-5"><h2 className="font-semibold">Session feedback</h2><Label>How hard was the training session? (0–5)</Label><input type="range" min="0" max="5" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} /><span className="text-xs text-muted-foreground">{difficulty}/5</span><Label>Any unnatural pains?</Label><Textarea value={painNotes} onChange={(event) => setPainNotes(event.target.value)} placeholder="Describe pain or discomfort" /><Label>How did the session feel overall? (0–5)</Label><input type="range" min="0" max="5" value={enjoyment} onChange={(event) => setEnjoyment(Number(event.target.value))} /><Button onClick={finishSession} disabled={pending}>{pending ? "Saving session..." : "Finish session"}</Button>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}</Card> : <p className="text-center text-xs text-muted-foreground">Complete all exercises to unlock session feedback and finish the session.</p>}<div className="flex justify-between"><Button variant="ghost" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}><ChevronLeft /> Previous</Button><Button variant="ghost" disabled={activeIndex === exercises.length - 1 || !completed.includes(activeIndex)} onClick={() => setActiveIndex((index) => Math.min(exercises.length - 1, index + 1))}>Next <ChevronRight /></Button></div></div>
}
