"use client"

import { useEffect, useState } from "react"
import { redeemParentCode } from "@/app/parent/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useT } from "@/components/providers/language-provider"

type ParentData = {
  athlete?: { name?: string | null } | null
  attendance?: { id?: string; date: string; status?: string | null; title?: string | null }[] | null
  upcoming_sessions?: { id: string; date: string; title: string | null }[] | null
  health_summary?: { rpe?: number | null; pain_flags?: number | null; symptoms_reported?: number | null } | null
}

export function ParentView() {
  const t = useT()
  const [code, setCode] = useState("")
  const [data, setData] = useState<ParentData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (!data) return; const timeout = window.setTimeout(() => setData(null), 60 * 60 * 1000); return () => window.clearTimeout(timeout) }, [data])
  async function redeem(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("")
    let result: Awaited<ReturnType<typeof redeemParentCode>>
    try { result = await redeemParentCode(code.trim()) } catch { result = { error: t("That access code is invalid or expired.") } }
    setLoading(false)
    if (result.error || !result.data) { setError(result.error ?? t("That access code is invalid or expired.")); return }
    setData(result.data)
  }
  if (!data) return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6"><div><p className="text-sm text-muted-foreground">{t("Troy Team")}</p><h1 className="text-3xl font-bold">{t("Parent View")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("View your child's attendance and training health summary.")}</p></div><Card><CardHeader><CardTitle>{t("Enter your athlete's access code")}</CardTitle></CardHeader><CardContent><form onSubmit={redeem} className="flex flex-col gap-4"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t("Access code")} required /><Button type="submit" disabled={loading}>{loading ? t("Checking…") : t("View progress")}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form></CardContent></Card></main>
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8"><div><p className="text-sm text-muted-foreground">{t("Read-only parent access")}</p><h1 className="text-3xl font-bold">{data.athlete?.name || t("Athlete")}</h1></div><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>{t("Upcoming sessions")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{data.upcoming_sessions?.length ? data.upcoming_sessions.map((session) => <div key={`${session.id}-${session.date}`} className="flex justify-between border-b pb-2 text-sm"><span>{session.title}</span><span className="tabular text-muted-foreground">{session.date}</span></div>) : <p className="text-sm text-muted-foreground">{t("No upcoming sessions.")}</p>}</CardContent></Card><Card><CardHeader><CardTitle>{t("Health summary")}</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-center"><div><p className="tabular text-2xl font-bold">{data.health_summary?.rpe != null ? `${data.health_summary.rpe}/10` : "—"}</p><p className="text-xs text-muted-foreground">{t("Latest RPE")}</p></div><div><p className="tabular text-2xl font-bold">{data.health_summary?.pain_flags ?? 0}</p><p className="text-xs text-muted-foreground">{t("Pain flags")}</p></div></CardContent></Card></div><Card><CardHeader><CardTitle>{t("Attendance")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{data.attendance?.length ? data.attendance.map((item, index) => <div key={`${item.date}-${index}`} className="flex justify-between gap-3 border-b py-2 text-sm"><span className="min-w-0 truncate"><span className="tabular">{item.date}</span> <span className="text-muted-foreground">· {item.title}</span></span><span className={item.status === "present" ? "text-green-700" : "text-destructive"}>{item.status === "present" ? t("Present") : t("Absent")}</span></div>) : <p className="text-sm text-muted-foreground">{t("No attendance history yet.")}</p>}</CardContent></Card><Button variant="outline" onClick={() => setData(null)}>{t("Back to code entry")}</Button></main>
}
