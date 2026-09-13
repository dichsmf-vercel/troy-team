import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AthleteHeader } from "@/components/athlete/athlete-header"

export default async function AthleteProgramPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: assignment } = await supabase.from("athlete_programs").select("status, month_start, month_end, programs(name_en, description_en)").eq("athlete_id", user.id).in("status", ["approved", "active"]).order("month_start", { ascending: false }).limit(1).maybeSingle()
  const monthStart = assignment?.month_start ? new Date(`${assignment.month_start}T12:00:00`) : new Date()
  const monthTitle = monthStart.toLocaleDateString("en", { month: "long", year: "numeric" })
  const days = Array.from({ length: 28 }, (_, index) => { const date = new Date(monthStart); date.setDate(monthStart.getDate() + index); return { day: date.getDate(), weekday: date.toLocaleDateString("en", { weekday: "short" }), date: date.toISOString().slice(0, 10), hasSession: false } })
  return <div><AthleteHeader title="My program" /><main className="grid gap-6 px-4 py-6"><section className="rounded-3xl bg-primary p-5 text-primary-foreground"><p className="text-sm text-primary-foreground/70">Four-week plan</p><h1 className="mt-1 text-2xl font-semibold">{(assignment?.programs as any)?.name_en ?? "No approved program yet"}</h1><p className="mt-2 text-sm text-primary-foreground/75">{(assignment?.programs as any)?.description_en ?? "Your coach will publish your monthly program here."}</p></section><section className="grid gap-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{monthTitle}</h2><span className="text-xs text-muted-foreground">Calendar</span></div><div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <span key={day} className="py-1">{day}</span>)}{days.map((item) => <div key={item.date} className={`min-h-12 rounded-xl border p-1 ${item.hasSession ? "border-accent bg-accent/10" : "bg-card"}`}><span className="text-xs font-medium">{item.day}</span>{item.hasSession ? <span className="mx-auto mt-1 block size-1.5 rounded-full bg-accent" /> : null}</div>)}</div></section><section className="grid gap-3"><h2 className="text-lg font-semibold">Session details</h2><div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Approved sessions will appear here in chronological order with exercises, sets, reps, and coaching notes.</div></section></main></div>
}
