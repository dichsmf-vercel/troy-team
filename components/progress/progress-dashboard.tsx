"use client"

import { CalendarCheck, Gauge, Scale, TrendingDown, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/components/providers/language-provider"
import { safeDate } from "@/lib/formatters"

type Measurement = { date: string; weight: number | null; bodyFat: number | null }
type RpePoint = { date: string; rpe: number }
type Props = { measurements: Measurement[]; rpeHistory: RpePoint[]; attendanceRate: number; totalAttended: number; avgRpe: number | null }

function formatDate(value: string, language: string) {
  return safeDate(value, language === "ar" ? "ar-SA" : "en-GB", { day: "2-digit", month: "short" })
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <Card className="min-w-0"><CardContent className="flex min-w-0 flex-col gap-3 p-5"><div className="flex min-w-0 items-center gap-2 text-muted-foreground">{icon}<span className="truncate text-sm">{label}</span></div><strong className="text-3xl tabular-nums">{value}</strong><span className="text-xs text-muted-foreground">{detail}</span></CardContent></Card>
}

export function ProgressDashboard({ measurements, rpeHistory, attendanceRate, totalAttended, avgRpe }: Props) {
  const { dict, language } = useLanguage()
  const latest = measurements.at(-1)
  const first = measurements[0]
  const validWeights = measurements.map((item) => item.weight).filter((item): item is number => item != null && Number.isFinite(item))
  const validBodyFat = measurements.map((item) => item.bodyFat).filter((item): item is number => item != null && Number.isFinite(item))
  const maxWeight = Math.max(...validWeights, 1)
  const minWeight = Math.min(...validWeights, 0)
  const weightChange = latest?.weight != null && first?.weight != null ? latest.weight - first.weight : null
  const bodyFatChange = latest?.bodyFat != null && first?.bodyFat != null ? latest.bodyFat - first.bodyFat : null
  const maxRpe = Math.max(...rpeHistory.map((item) => item.rpe), 10)
  const hasMeasurements = validWeights.length > 0 || validBodyFat.length > 0
  const insight = weightChange === null ? dict.progress.insight : weightChange < 0 ? (language === "ar" ? "تقدم ممتاز في الوزن. استمر على هذا الإيقاع." : "Excellent weight progress. Keep this rhythm.") : (language === "ar" ? "القياسات مستقرة. ركز على الانتظام والتعافي." : "Measurements are steady. Focus on consistency and recovery.")
  const noData = language === "ar" ? "لا توجد بيانات بعد" : "No data yet"
  const latestLabel = language === "ar" ? "آخر قياس" : "Latest measurement"
  const changeLabel = language === "ar" ? "التغير منذ أول قياس" : "Change since first measurement"
  return <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 overflow-hidden px-4 py-6 pb-24 md:px-8">
    <header className="flex min-w-0 flex-col gap-1"><p className="text-sm text-muted-foreground">{dict.common.progress}</p><h1 className="text-balance text-3xl font-bold tracking-tight">{dict.progress.title}</h1><p className="text-pretty text-sm leading-6 text-muted-foreground">{language === "ar" ? "تابع قياساتك وتعافيك وانتظامك في مكان واحد." : "Track your measurements, recovery, and consistency in one place."}</p></header>
    <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={<CalendarCheck className="size-5" />} label={dict.progress.attendance} value={`${attendanceRate}%`} detail={`${totalAttended} ${dict.progress.sessions}`} />
      <Metric icon={<Gauge className="size-5" />} label={dict.progress.avgRpe} value={avgRpe != null ? `${avgRpe}/10` : "—"} detail={dict.progress.recovery} />
      <Metric icon={<Scale className="size-5" />} label={dict.progress.weight} value={latest?.weight != null ? `${latest.weight} kg` : "—"} detail={weightChange != null ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg` : noData} />
      <Metric icon={weightChange != null && weightChange <= 0 ? <TrendingDown className="size-5" /> : <TrendingUp className="size-5" />} label={language === "ar" ? "القياسات" : "Measurements"} value={measurements.length ? String(measurements.length) : "—"} detail={bodyFatChange != null ? `${bodyFatChange > 0 ? "+" : ""}${bodyFatChange.toFixed(1)}% body fat` : noData} />
    </section>
    <Card><CardHeader><CardTitle>{language === "ar" ? "ملخص التقدم" : "Progress summary"}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">{latestLabel}</p><p className="mt-1 text-lg font-semibold">{latest?.date ? formatDate(latest.date, language) : noData}</p></div><div><p className="text-sm text-muted-foreground">{changeLabel}</p><p className="mt-1 text-lg font-semibold">{weightChange != null ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg` : "—"}</p></div><p className="sm:col-span-2 leading-6 text-muted-foreground">{insight}</p></CardContent></Card>
    <section className="grid min-w-0 gap-4 lg:grid-cols-2">
      <TrendCard title={language === "ar" ? "الوزن" : "Weight"} empty={noData} data={measurements} max={maxWeight} getValue={(item) => item.weight} format={(value) => `${value} kg`} language={language} />
      <TrendCard title={language === "ar" ? "نسبة الدهون" : "Body fat"} empty={noData} data={measurements} max={Math.max(...validBodyFat, 1)} getValue={(item) => item.bodyFat} format={(value) => `${value}%`} language={language} />
      <TrendCard title={dict.progress.rpeTitle} empty={noData} data={rpeHistory} max={maxRpe} getValue={(item) => item.rpe} format={(value) => `${value}/10`} language={language} />
      <Card className="min-w-0"><CardHeader><CardTitle>{language === "ar" ? "سجل القياسات" : "Measurement history"}</CardTitle></CardHeader><CardContent>{hasMeasurements ? <div className="grid gap-2">{measurements.slice().reverse().slice(0, 6).map((item) => <div key={item.date} className="flex min-w-0 items-center justify-between gap-3 border-b py-2 last:border-0"><span className="shrink-0 text-sm text-muted-foreground">{formatDate(item.date, language)}</span><span className="truncate text-right text-sm tabular-nums">{item.weight != null ? `${item.weight} kg` : "—"}{item.bodyFat != null ? ` · ${item.bodyFat}%` : ""}</span></div>)}</div> : <p className="text-sm text-muted-foreground">{noData}</p>}</CardContent></Card>
    </section>
  </main>
}

function TrendCard<T extends { date: string }>({ title, empty, data, max, getValue, format, language }: { title: string; empty: string; data: T[]; max: number; getValue: (item: T) => number | null; format: (value: number) => string; language: string }) {
  const values = data.map(getValue).filter((item): item is number => item != null && Number.isFinite(item))
  return <Card className="min-w-0 overflow-hidden"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{values.length ? <div className="flex h-56 min-w-0 items-end gap-2 overflow-hidden">{data.map((item, index) => { const value = getValue(item); return <div key={`${item.date}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="w-full min-w-0 rounded-t-sm bg-accent/80" style={{ height: value == null ? "8px" : `${Math.max(12, (value / max) * 170)}px` }} title={value == null ? empty : format(value)} /><span className="max-w-full truncate text-[11px] text-muted-foreground">{formatDate(item.date, language)}</span></div> })}</div> : <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">{empty}</div>}</CardContent></Card>
}
