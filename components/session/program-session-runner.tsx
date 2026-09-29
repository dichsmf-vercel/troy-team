"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveProgramExerciseFeedback } from "@/app/(athlete)/program/session/actions"

export function ProgramSessionRunner({ programId, date, time, exercises, initialFeedback }: { programId: string; date: string; time: string; exercises: any[]; initialFeedback: any[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [completed, setCompleted] = useState<number[]>(initialFeedback.map((item) => item.exercise_index))
  const [difficulty, setDifficulty] = useState(3)
  const [painNotes, setPainNotes] = useState("")
  const [enjoyment, setEnjoyment] = useState(3)
  const [pending, startTransition] = useTransition()
  const active = exercises[activeIndex]
  const isComplete = completed.length === exercises.length && exercises.length > 0
  function submitFeedback() { startTransition(async () => { const result = await saveProgramExerciseFeedback({ programId, date, exerciseIndex: activeIndex, difficulty, painNotes, enjoyment }); if (result.error) return; setCompleted((current) => current.includes(activeIndex) ? current : [...current, activeIndex]); setPainNotes(""); if (activeIndex < exercises.length - 1) setActiveIndex((index) => index + 1) }) }
  if (!exercises.length) return <Card className="p-6 text-center"><p className="font-medium">No exercises scheduled</p><Link className="mt-4 inline-flex text-sm text-primary underline" href="/program">Back to program</Link></Card>
  return <div className="mx-auto grid max-w-xl gap-5"><div><p className="text-xs text-muted-foreground">{date} · {time}</p><h1 className="mt-1 text-2xl font-semibold">Program training</h1><p className="mt-1 text-sm text-muted-foreground">Exercise {activeIndex + 1} of {exercises.length}</p></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(completed.length / exercises.length) * 100}%` }} /></div><Card className="grid gap-4 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{active.section ?? "Training"}</p><h2 className="text-xl font-semibold">{active.name_en ?? active.name ?? "Exercise"}</h2><p className="text-sm text-muted-foreground">{active.sets ?? "-"} sets · {active.reps ?? "-"} reps</p>{active.image_url ? <img src={active.image_url} alt={active.name_en ?? "Exercise"} className="aspect-video w-full rounded-lg object-cover" /> : null}{active.video_youtube_url ? <a href={active.video_youtube_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Watch exercise video</a> : null}<div className="grid gap-3 border-t pt-4"><Label>How hard was this exercise? (0–5)</Label><input type="range" min="0" max="5" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} /><span className="text-sm text-muted-foreground">{difficulty}/5</span><Label>Any unnatural pains?</Label><Textarea value={painNotes} onChange={(event) => setPainNotes(event.target.value)} placeholder="Describe any pain or discomfort" /><Label>How did this exercise feel overall? (0–5)</Label><input type="range" min="0" max="5" value={enjoyment} onChange={(event) => setEnjoyment(Number(event.target.value))} /><Button onClick={submitFeedback} disabled={pending}>{pending ? "Saving feedback..." : completed.includes(activeIndex) ? "Feedback saved" : "Save feedback and continue"}</Button></div><div className="flex justify-between"><Button variant="ghost" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}><ChevronLeft className="mr-1 size-4" />Previous</Button><Button variant="ghost" disabled={activeIndex === exercises.length - 1 || !completed.includes(activeIndex)} onClick={() => setActiveIndex((index) => Math.min(exercises.length - 1, index + 1))}>Next<ChevronRight className="ml-1 size-4" /></Button></div></Card>{isComplete ? <div className="grid gap-2 text-center"><p className="text-sm font-medium text-emerald-600"><Check className="mr-1 inline size-4" />Session attended and completed</p><Link href="/dashboard" className="text-sm text-primary underline">Return to dashboard</Link></div> : null}</div>
}
