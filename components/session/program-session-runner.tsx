"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function ProgramSessionRunner({ date, time, exercises }: { date: string; time: string; exercises: any[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [completed, setCompleted] = useState<number[]>([])
  const active = exercises[activeIndex]
  const isComplete = completed.length === exercises.length && exercises.length > 0
  function markComplete() { setCompleted((current) => current.includes(activeIndex) ? current : [...current, activeIndex]); if (activeIndex < exercises.length - 1) setActiveIndex((index) => index + 1) }
  if (!exercises.length) return <Card className="p-6 text-center"><p className="font-medium">No exercises scheduled</p><Link className="mt-4 inline-flex text-sm text-primary underline" href="/program">Back to program</Link></Card>
  return <div className="mx-auto grid max-w-xl gap-5"><div><p className="text-xs text-muted-foreground">{date} · {time}</p><h1 className="mt-1 text-2xl font-semibold">Program training</h1><p className="mt-1 text-sm text-muted-foreground">Exercise {activeIndex + 1} of {exercises.length}</p></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(completed.length / exercises.length) * 100}%` }} /></div><Card className="grid gap-4 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{active.section ?? "Training"}</p><h2 className="text-xl font-semibold">{active.name_en ?? active.name ?? "Exercise"}</h2><p className="text-sm text-muted-foreground">{active.sets ?? "-"} sets · {active.reps ?? "-"} reps</p>{active.image_url ? <img src={active.image_url} alt={active.name_en ?? "Exercise"} className="aspect-video w-full rounded-lg object-cover" /> : null}{active.video_youtube_url ? <a href={active.video_youtube_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Watch exercise video</a> : null}<Button onClick={markComplete}>{isComplete ? <><Check className="mr-2 size-4" />Training complete</> : "Complete exercise and continue"}</Button><div className="flex justify-between"><Button variant="ghost" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}><ChevronLeft className="mr-1 size-4" />Previous</Button><Button variant="ghost" disabled={activeIndex === exercises.length - 1 || !completed.includes(activeIndex)} onClick={() => setActiveIndex((index) => Math.min(exercises.length - 1, index + 1))}>Next<ChevronRight className="ml-1 size-4" /></Button></div></Card>{isComplete ? <Link href="/dashboard" className="text-center text-sm text-primary underline">Return to dashboard</Link> : null}</div>
}
