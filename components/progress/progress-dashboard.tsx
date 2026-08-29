"use client"

import { BarChart3, CalendarCheck, Gauge, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/components/providers/language-provider"

type Props = { measurements: { date: string; weight: number | null; bodyFat: number | null }[]; rpeHistory: { date: string; rpe: number }[]; attendanceRate: number; totalAttended: number; avgRpe: number | null }

export function ProgressDashboard({ measurements, rpeHistory, attendanceRate, totalAttended, avgRpe }: Props) {
  const { dict, language } = useLanguage()
  const latest = measurements.at(-1)
  const first = measurements[0]
  const weightValues = measurements.map((m) => m.weight).filter((value): value is number => value != null && Number.isFinite(value))
  const maxWeight = Math.max(...weightValues, 1)
  const weightChange = latest?.weight != null && first?.weight != null ? latest.weight - first.weight : null
  const insight = weightChange === null ? dict.progress.insight : weightChange < 0 ? (language === "ar" ? "تقدم ممتاز في الوزن. استمر على هذا الإيقاع." : "Excellent weight progress. Keep this rhythm.") : (language === "ar" ? "القياسات مستقرة. ركز على الانتظام والتعافي." : "Measurements are steady. Focus on consistency and recovery.")
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 pb-24 md:px-8">
    <header><p className="text-sm text-muted-foreground">{dict.common.progress}</p><h1 className="text-3xl font-bold tracking-tight">{dict.progress.title}</h1></header>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Metric icon={<CalendarCheck className="size-5" />} label={dict.progress.attendance} value={`${attendanceRate}%`} detail={`${totalAttended} ${dict.progress.sessions}`} />
      <Metric icon={<Gauge className="size-5" />} label={dict.progress.avgRpe} value={avgRpe ? `${avgRpe}/10` : "—"} detail={dict.progress.recovery} />
      <Metric icon={<TrendingUp className="size-5" />} label={dict.progress.weight} value={latest?.weight ? `${latest.weight} kg` : "—"} detail={weightChange !== null ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg` : dict.progress.noData} />
    </section>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-accent" />{dict.progress.insightTitle}</CardTitle></CardHeader><CardContent><p className="leading-6 text-muted-foreground">{insight}</p></CardContent></Card>
    <section className="grid gap-4 md:grid-cols-2">
      <Card><CardHeader><CardTitle>{dict.progress.weight}</CardTitle></CardHeader><CardContent><div className="flex h-48 items-end gap-2">{measurements.length ? measurements.map((m, i) => <div key={m.date} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-sm bg-accent/80" style={{ height: `${Math.max(12, ((m.weight ?? 0) / maxWeight) * 150)}px` }} /><span className="text-xs text-muted-foreground">{i + 1}</span></div>) : <p className="text-sm text-muted-foreground">{dict.progress.noData}</p>}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>{dict.progress.rpeTitle}</CardTitle></CardHeader><CardContent><div className="flex h-48 items-end gap-2">{rpeHistory.length ? rpeHistory.map((item, i) => <div key={item.date} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-sm bg-team-academy/80" style={{ height: `${Math.max(12, item.rpe * 15)}px` }} /><span className="text-xs text-muted-foreground">{i + 1}</span></div>) : <p className="text-sm text-muted-foreground">{dict.progress.noData}</p>}</div></CardContent></Card>
    </section>
  </main>
}
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <Card><CardContent className="flex flex-col gap-3 p-5"><div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-sm">{label}</span></div><strong className="tabular text-3xl">{value}</strong><span className="text-xs text-muted-foreground">{detail}</span></CardContent></Card> }
