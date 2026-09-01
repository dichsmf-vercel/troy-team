"use client"

import { useActionState, useState } from "react"
import { Plus, GripVertical, X } from "lucide-react"
import { createSessionPost } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { safeTime } from "@/lib/formatters"

type Props = { teams: any[]; athletes: any[]; sessions: any[]; exercises: any[] }
type Row = { exercise: string; sets: string; reps: string; load: string; unit: "percent" | "kg" }
const initialRow: Row = { exercise: "", sets: "3", reps: "8", load: "", unit: "percent" }

export function SessionPanel({ teams, athletes, sessions, exercises }: Props) {
  const [targetType, setTargetType] = useState<"team" | "athlete">("team")
  const [rows, setRows] = useState<Row[]>([{ ...initialRow }])
  const [state, action, pending] = useActionState(async (_: { error: string | null } | null, form: FormData) => createSessionPost(form), { error: null })
  const addRow = () => setRows((current) => [...current, { ...initialRow }])
  return <div className="grid min-w-0 gap-6 overflow-hidden lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
    <Card className="min-w-0 overflow-hidden"><CardHeader className="min-w-0"><CardTitle className="flex items-center gap-2"><Plus className="size-5" />Create session</CardTitle></CardHeader><CardContent>
      <form action={action} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="session-title">Title (English)</Label><Input id="session-title" name="title_en" required /></div>
        <div className="grid gap-2"><Label htmlFor="session-title-ar">Title (Arabic)</Label><Input id="session-title-ar" name="title_ar" dir="rtl" /></div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Assignment mode"><Button type="button" variant={targetType === "team" ? "default" : "outline"} onClick={() => setTargetType("team")}>Team</Button><Button type="button" variant={targetType === "athlete" ? "default" : "outline"} onClick={() => setTargetType("athlete")}>Individual</Button></div>
        <input type="hidden" name="target_type" value={targetType} />
        <div className="grid min-w-0 gap-2"><Label className="min-w-0 break-words" htmlFor="target-id">{targetType === "team" ? "Team" : "Athlete"}</Label><select id="target-id" name="target_id" required className="h-10 min-w-0 max-w-full rounded-md border bg-background px-3 text-sm text-ellipsis"> <option value="">Choose {targetType}</option>{(targetType === "team" ? teams : athletes).map((item: any) => <option key={item.id} value={item.id}>{targetType === "team" ? item.name_en : `${item.profiles?.full_name ?? "Athlete"} (${item.display_id ?? item.id})`}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="session-date">Date</Label><Input id="session-date" name="session_date" type="date" required /></div><div className="grid gap-2"><Label htmlFor="session-start">Start time</Label><Input id="session-start" name="start_time" type="time" required /></div></div>
        <div className="grid gap-2"><Label htmlFor="session-notes">Notes</Label><textarea id="session-notes" name="notes" rows={3} className="rounded-md border bg-background px-3 py-2 text-sm" /></div>
        <div className="grid gap-3"><div className="flex items-center justify-between"><Label>Exercises</Label><Button type="button" variant="outline" onClick={addRow}><Plus className="mr-2 size-4" />Add exercise</Button></div>{rows.map((row, index) => <div className="grid gap-2 rounded-lg border p-3" key={index}><div className="flex items-center gap-2"><GripVertical className="size-4 text-muted-foreground" aria-hidden="true" /><select name="exercise_id" value={row.exercise} onChange={(event) => setRows((current) => current.map((r, i) => i === index ? { ...r, exercise: event.target.value } : r))} required className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"><option value="">Choose exercise</option>{exercises.map((exercise: any) => <option key={exercise.id} value={exercise.id}>{exercise.name_en}</option>)}</select>{rows.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} aria-label="Remove exercise"><X className="size-4" /></Button>}</div><div className="grid grid-cols-3 gap-2"><Input name="exercise_sets" value={row.sets} onChange={(event) => setRows((current) => current.map((r, i) => i === index ? { ...r, sets: event.target.value } : r))} type="number" min="1" required aria-label="Sets" placeholder="Sets" /><Input name="exercise_reps" value={row.reps} onChange={(event) => setRows((current) => current.map((r, i) => i === index ? { ...r, reps: event.target.value } : r))} type="number" min="1" required aria-label="Reps" placeholder="Reps" /><div className="min-w-0"><select name="exercise_load" value={row.load} onChange={(event) => setRows((current) => current.map((r, i) => i === index ? { ...r, load: event.target.value } : r))} aria-label="Load" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"><option value="">Load</option>{[50, 60, 70, 75, 80, 85, 90, 95, 100].map((value) => <option key={value} value={value}>{value}%</option>)}</select><select name="exercise_load_unit" value={row.unit} onChange={(event) => setRows((current) => current.map((r, i) => i === index ? { ...r, unit: event.target.value as Row["unit"] } : r))} aria-label="Load unit" className="h-10 w-20 rounded-md border bg-background px-2 text-xs"><option value="percent">%</option><option value="kg">kg</option></select></div></div></div>)}</div>
        {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save session"}</Button>
      </form>
    </CardContent></Card>
    <div className="grid content-start gap-3">{sessions.map((session: any) => <Card key={session.id}><CardContent className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate font-semibold">{session.title_en}</p>{session.notes ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{session.notes}</p> : null}<p className="text-sm text-muted-foreground tabular-nums">{session.session_date ? session.session_date.slice(0, 10) : "No date"} · {session.start_time ? safeTime(session.start_time) : "No start time"}</p></div></CardContent></Card>)}</div>
  </div>
}
