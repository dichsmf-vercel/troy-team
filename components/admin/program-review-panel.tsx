"use client"

import { readProgramSessions } from "@/lib/program-data"
import { firstRelation } from "@/lib/utils"
import { useState, useTransition } from "react"
import { Check, ChevronDown, Clock3, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { reviewAthleteProgram } from "@/app/admin/actions/programs"
import type { AdminProgram } from "@/lib/admin/types"
import { actionErrorMessage, isStaleActionError } from "@/lib/client-errors"
import { useT } from "@/components/providers/language-provider"

export function ProgramReviewPanel({ programs }: { programs: AdminProgram[] }) {
  const t = useT()
  const [items, setItems] = useState(Array.isArray(programs) ? programs : [])
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const act = (id: string, status: "approved" | "rejected") => startTransition(async () => {
    setMessage(null)
    try {
      const result = await reviewAthleteProgram(id, status)
      if (result.error) setMessage(result.error)
      else setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    } catch (err) {
      console.error("[Program-Review] Action error:", err)
      if (isStaleActionError(err)) {
        setMessage(t("The app was recently updated. Please refresh the page (Ctrl + F5)."))
      } else {
        setMessage(actionErrorMessage(err, t("An unexpected error occurred."), t))
      }
    }
  })
  return <Card><CardHeader><CardTitle>{t("Programs awaiting review")}</CardTitle><p className="text-sm text-muted-foreground">{t("Review generated four-week calendars before athletes can see them.")}</p></CardHeader><CardContent className="grid gap-3">{message ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}{items.length ? items.map((program) => { const sessions = readProgramSessions(program.generation_reason); const athlete = firstRelation(firstRelation(program.athletes)?.profiles)?.full_name ?? program.athlete_id; const open = openId === program.id; return <div key={program.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{athlete}</p><p className="text-sm text-muted-foreground">{t("{month_start} – {month_end} · {sessionsCount} sessions", { month_start: program.month_start, month_end: program.month_end, sessionsCount: sessions.length })}</p></div><div className="flex items-center gap-2">{program.status === "pending_review" ? <><Button size="sm" variant="outline" disabled={pending} onClick={() => act(program.id, "rejected")}><X className="mr-1 size-4" />{t("Reject")}</Button><Button size="sm" disabled={pending} onClick={() => act(program.id, "approved")}><Check className="mr-1 size-4" />{t("Approve")}</Button></> : <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{program.status?.replaceAll("_", " ")}</span>}<Button size="icon" variant="ghost" aria-label={t("Toggle program details")} onClick={() => setOpenId(open ? null : program.id)}><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></Button></div></div>{open ? <div className="mt-4 grid gap-2">{sessions.map((session) => <div key={session.date} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span>{session.date} · {session.time}</span><span className="text-muted-foreground">{t("{count} exercises", { count: session.exercises?.length ?? 0 })}{session.tooFewExercises ? ` · ${t("Review")}` : ""}</span></div>)}</div> : null}</div> }) : <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><Clock3 className="mx-auto mb-2 size-5" />{t("No generated programs awaiting review.")}</div>}</CardContent></Card>
}
