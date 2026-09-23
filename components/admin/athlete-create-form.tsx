"use client"

import { useState } from "react"
import { createAthleteAccount } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const fms = ["deep_squat", "hurdle_step", "inline_lunge", "shoulder_mobility", "active_straight_leg_raise", "trunk_stability", "rotary_stability"]
const performance = ["v_jump_cm", "sprint_30m_seconds", "t_test_seconds", "beep_test_level", "beep_test_speed", "beep_test_vo2_max", "star_balance", "agility_y ah_seconds"]
const maxes = ["squat_1rm_kg", "bench_press_1rm_kg", "deadlift_1rm_kg", "power_clean_1rm_kg", "shoulder_press_1rm_kg"]

export function AthleteCreateForm({ teams = [] }: { teams: any[] }) {
  const [message, setMessage] = useState<string | null>(null)
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [fmsScores, setFmsScores] = useState<Record<string, string>>({})
  const bmi = Number(height) > 0 && Number(weight) > 0 ? (Number(weight) / ((Number(height) / 100) ** 2)).toFixed(1) : "—"
  const fmsTotal = Object.values(fmsScores).reduce((total, value) => total + (value === "" ? 0 : Number(value)), 0)
  return <form action={async (form) => { setMessage("Creating athlete..."); const result = await createAthleteAccount(form); setMessage(result.error ?? "Athlete created. Send the invitation from the athlete record when ready.") }} className="grid gap-6 rounded-2xl border bg-card p-5">
    <div><h2 className="text-lg font-semibold">Create athlete</h2><p className="mt-1 text-sm text-muted-foreground">Only full name and email are required. Complete the assessment when information is available.</p></div>
    <section className="grid gap-4"><h3 className="text-lg font-semibold tracking-tight">Account</h3><div className="grid gap-4 sm:grid-cols-2"><div><Label className="pb-0.5" htmlFor="full-name">Full name</Label><Input id="full-name" name="full_name" required /></div><div><Label className="pb-0.5" htmlFor="arabic-name">Arabic name</Label><Input id="arabic-name" name="full_name_ar" /></div><div><Label className="pb-0.5" htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div><div><Label className="pb-0.5" htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div><div><Label className="pb-0.5" htmlFor="team">Team (optional)</Label><select id="team" name="team_id" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Individual athlete</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name_en}</option>)}</select></div></div></section>
    <section className="grid gap-4"><h3 className="text-lg font-semibold tracking-tight">Body measurements</h3><div className="grid gap-4 sm:grid-cols-3"><div><Label className="pb-0.5" htmlFor="height">Height (cm)</Label><Input id="height" name="height_cm" type="number" step="0.1" value={height} onChange={(event) => setHeight(event.target.value)} /></div><div><Label className="pb-0.5" htmlFor="weight">Weight (kg)</Label><Input id="weight" name="weight_kg" type="number" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} /></div><div><Label className="pb-0.5" htmlFor="body-fat">Body fat (%)</Label><Input id="body-fat" name="body_fat_pct" type="number" step="0.1" /></div><div className="rounded-lg border bg-muted/30 p-3 text-sm"><span className="text-muted-foreground">BMI</span><strong className="ml-2">{bmi}</strong></div></div></section>
    <section className="grid gap-4"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold tracking-tight">FMS assessment <span className="text-sm font-normal text-muted-foreground">0–3 each</span></h3><span className="text-sm text-muted-foreground">Total: {fmsTotal}/21</span></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fms.map((field) => <div key={field}><Label className="pb-0.5" htmlFor={field}>{field.replaceAll("_", " ")}</Label><Input id={field} name={field} type="number" min="0" max="3" step="1" value={fmsScores[field] ?? ""} onChange={(event) => setFmsScores((current) => ({ ...current, [field]: event.target.value }))} /></div>)}</div></section>
    <section className="grid gap-4"><h3 className="text-lg font-semibold tracking-tight">Performance tests</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{performance.map((field) => <div key={field}><Label className="pb-0.5" htmlFor={field}>{field.replaceAll("_", " ")}</Label><Input id={field} name={field} type="number" step="0.01" /></div>)}</div></section>
    <section className="grid gap-4"><h3 className="text-lg font-semibold tracking-tight">Strength maxes (kg)</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{maxes.map((field) => <div key={field}><Label className="pb-0.5" htmlFor={field}>{field.replace("_1rm_kg", "").replaceAll("_", " ")}</Label><Input id={field} name={field} type="number" step="0.1" /></div>)}</div></section>
    <div><Label className="pb-0.5" htmlFor="coach-notes">Coach notes</Label><textarea id="coach-notes" name="coach_notes" className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>
    <Button type="submit">Create athlete</Button>{message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
  </form>
}
