"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function ParentView() {
  const [code, setCode] = useState("")
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (!data) return; const timeout = window.setTimeout(() => setData(null), 60 * 60 * 1000); return () => window.clearTimeout(timeout) }, [data])
  async function redeem(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("")
    const { data: result, error: rpcError } = await createClient().rpc("redeem_parent_link", { code: code.trim() })
    setLoading(false)
    if (rpcError || !result) { setError("That access code is invalid or expired."); return }
    setData(result)
  }
  if (!data) return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6"><div><p className="text-sm text-muted-foreground">Troy Team</p><h1 className="text-3xl font-bold">Parent View</h1><p className="mt-2 text-sm text-muted-foreground">View your child&apos;s attendance and training health summary.</p></div><Card><CardHeader><CardTitle>Enter your child&apos;s access code</CardTitle></CardHeader><CardContent><form onSubmit={redeem} className="flex flex-col gap-4"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Access code" required /><Button type="submit" disabled={loading}>{loading ? "Checking…" : "View progress"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form></CardContent></Card></main>
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8"><div><p className="text-sm text-muted-foreground">Read-only parent access</p><h1 className="text-3xl font-bold">{data.athlete?.name || "Athlete"}</h1></div><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Upcoming sessions</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{data.upcoming_sessions?.length ? data.upcoming_sessions.map((session: any) => <div key={`${session.id}-${session.date}`} className="flex justify-between border-b pb-2 text-sm"><span>{session.title}</span><span className="tabular text-muted-foreground">{session.date}</span></div>) : <p className="text-sm text-muted-foreground">No upcoming sessions.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Health summary</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-3 text-center"><div><p className="tabular text-2xl font-bold">{data.health_summary?.rpe ?? "—"}</p><p className="text-xs text-muted-foreground">Latest RPE</p></div><div><p className="tabular text-2xl font-bold">{data.health_summary?.pain_flags ?? 0}</p><p className="text-xs text-muted-foreground">Pain flags</p></div><div><p className="tabular text-2xl font-bold">{data.health_summary?.symptoms_reported ?? 0}</p><p className="text-xs text-muted-foreground">Symptoms</p></div></CardContent></Card></div><Card><CardHeader><CardTitle>Attendance</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{data.attendance?.length ? data.attendance.map((item: any) => <div key={item.date} className="flex justify-between border-b py-2 text-sm"><span className="tabular">{item.date}</span><span className={item.status === "present" ? "text-green-700" : "text-destructive"}>{item.status === "present" ? "Present" : "Absent"}</span></div>) : <p className="text-sm text-muted-foreground">No attendance history yet.</p>}</CardContent></Card><Button variant="outline" onClick={() => setData(null)}>Back to code entry</Button></main>
}
