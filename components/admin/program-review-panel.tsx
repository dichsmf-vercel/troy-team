"use client"

import { useState, useTransition } from "react"
import { Check, ChevronDown, Clock3, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { reviewAthleteProgram } from "@/app/admin/actions"

export function ProgramReviewPanel({ programs }: { programs: any[] }) {
  const [items, setItems] = useState(Array.isArray(programs) ? programs : [])
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const act = (id: string, status: "approved" | "rejected") => startTransition(async () => { const result = await reviewAthleteProgram(id, status); if (!result.error) setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item)) })
  return <Card><CardHeader><CardTitle>Programs awaiting review</CardTitle><p className="text-sm text-muted-foreground">Review generated four-week calendars before athletes can see them.</p></CardHeader><CardContent className="grid gap-3">{items.length ? items.map((program) => { const sessions = Array.isArray(program.generation_reason?.sessions) ? program.generation_reason.sessions : []; const athlete = program.athletes?.profiles?.full_name ?? program.athlete_id; const open = openId === program.id; return <div key={program.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{athlete}</p><p className="text-sm text-muted-foreground">{program.month_start} – {program.month_end} · {sessions.length} sessions</p></div><div className="flex items-center gap-2">{program.status === "pending_review" ? <><Button size="sm" variant="outline" disabled={pending} onClick={() => act(program.id, "rejected")}><X className="mr-1 size-4" />Reject</Button><Button size="sm" disabled={pending} onClick={() => act(program.id, "approved")}><Check className="mr-1 size-4" />Approve</Button></> : <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{program.status?.replaceAll("_", " ")}</span>}<Button size="icon" variant="ghost" aria-label="Toggle program details" onClick={() => setOpenId(open ? null : program.id)}><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></Button></div></div>{open ? <div className="mt-4 grid gap-2">{sessions.map((session: any) => <div key={session.date} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span>{session.date} · {session.time}</span><span className="text-muted-foreground">{session.exercises?.length ?? 0} exercises{session.tooFewExercises ? " · Review" : ""}</span></div>)}</div> : null}</div> }) : <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><Clock3 className="mx-auto mb-2 size-5" />No generated programs awaiting review.</div>}</CardContent></Card>
}
