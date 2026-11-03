"use client"

import { useState } from "react"
import { Copy, CheckCheck } from "lucide-react"
import { createAthleteAccount } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

// FMS: 0 = ضعيف جدا, 1 = ضعيف, 2 = جيد/متوسط, 3 = ممتاز
const FMS_OPTIONS = [
  { value: "0", label: "0 – ضعيف جدا" },
  { value: "1", label: "1 – ضعيف" },
  { value: "2", label: "2 – جيد / متوسط" },
  { value: "3", label: "3 – ممتاز" },
]

const FMS_FIELDS: { key: string; label: string }[] = [
  { key: "deep_squat", label: "Deep Squat" },
  { key: "hurdle_step", label: "Hurdle Step" },
  { key: "inline_lunge", label: "Inline Lunge" },
  { key: "shoulder_mobility", label: "Shoulder Mobility" },
  { key: "active_straight_leg_raise", label: "Active Straight-Leg Raise" },
  { key: "trunk_stability", label: "Trunk Stability Push-Up" },
  { key: "rotary_stability", label: "Rotary Stability" },
]

const PERFORMANCE_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "v_jump_cm", label: "Vertical Jump", unit: "cm" },
  { key: "sprint_30m_seconds", label: "30m Sprint", unit: "sec" },
  { key: "t_test_seconds", label: "T-Test", unit: "sec" },
  { key: "beep_test_level", label: "Beep Test Level", unit: "" },
  { key: "beep_test_vo2_max", label: "Beep Test VO₂ Max", unit: "" },
  { key: "star_balance", label: "Star Balance", unit: "" },
  { key: "agility_rshaqah_seconds", label: "Agility (Rshaqah)", unit: "sec" },
]

// Strength: kg + reps for Epley 1RM estimation
const STRENGTH_FIELDS: { key: string; label: string }[] = [
  { key: "squat", label: "Back Squat" },
  { key: "bench_press", label: "Bench Press" },
  { key: "deadlift", label: "Deadlift" },
  { key: "power_clean", label: "Power Clean" },
  { key: "shoulder_press", label: "Shoulder Press" },
]

const SPORTS = ["Handball", "Football", "Basketball", "Volleyball", "Hockey", "Swimming", "Athletics", "Other"]

type CreatedAthlete = { troyId: string; temporaryPassword: string; name: string }

function epley1RM(kg: number, reps: number): number {
  if (reps === 1) return kg
  return Math.round(kg * (1 + reps / 30))
}

export function AthleteCreateForm({ teams = [] }: { teams: any[] }) {
  const [message, setMessage] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedAthlete | null>(null)
  const [copied, setCopied] = useState<"id" | "pass" | null>(null)
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [fmsScores, setFmsScores] = useState<Record<string, string>>({})
  // strength: { squat: { kg: "", reps: "" }, ... }
  const [strengthInputs, setStrengthInputs] = useState<Record<string, { kg: string; reps: string }>>({})

  const bmi = Number(height) > 0 && Number(weight) > 0
    ? (Number(weight) / ((Number(height) / 100) ** 2)).toFixed(1)
    : "—"
  const fmsTotal = Object.values(fmsScores).reduce((t, v) => t + (v === "" ? 0 : Number(v)), 0)

  function updateStrength(field: string, part: "kg" | "reps", value: string) {
    setStrengthInputs((prev) => ({ ...prev, [field]: { ...prev[field], [part]: value } }))
  }

  function copy(text: string, type: "id" | "pass") {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleSubmit(form: FormData) {
    setMessage("Creating athlete…")
    setCreated(null)

    // Inject Epley-estimated 1RMs into the form
    for (const { key } of STRENGTH_FIELDS) {
      const inputs = strengthInputs[key]
      if (inputs?.kg && inputs?.reps) {
        const kg = Number(inputs.kg)
        const reps = Number(inputs.reps)
        if (kg > 0 && reps > 0) {
          form.set(`${key}_1rm_kg`, String(epley1RM(kg, reps)))
        }
      }
    }

    const result = await createAthleteAccount(form)
    if (result.error) { setMessage(result.error); return }
    setCreated({
      troyId: result.troyId!,
      temporaryPassword: result.temporaryPassword!,
      name: String(form.get("full_name") || "Athlete"),
    })
    setMessage(null)
  }

  if (created) {
    return (
      <div className="grid gap-4 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold">{created.name} created</p>
            <p className="text-sm text-muted-foreground">Share these credentials with the athlete. They will be asked to set a new password on first login.</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Troy ID (login)</p>
              <p className="mt-0.5 font-mono text-lg font-bold tracking-widest">{created.troyId}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copy(created.troyId, "id")} className="gap-1.5 shrink-0">
              {copied === "id" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === "id" ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="border-t pt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Temporary password</p>
              <p className="mt-0.5 font-mono text-sm font-semibold">{created.temporaryPassword}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copy(created.temporaryPassword, "pass")} className="gap-1.5 shrink-0">
              {copied === "pass" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === "pass" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <Badge variant="secondary" className="w-fit text-amber-700 bg-amber-500/10">
          Save this password now — it won't be shown again
        </Badge>

        <Button variant="outline" onClick={() => setCreated(null)}>Create another athlete</Button>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="grid gap-6 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Create athlete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A Troy ID and temporary password will be generated automatically. Only full name is required — complete assessment when available.
        </p>
      </div>

      {/* Account */}
      <section className="grid gap-4">
        <h3 className="font-semibold tracking-tight border-b pb-2">Account</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="full-name">Full name *</Label><Input id="full-name" name="full_name" required className="mt-1" /></div>
          <div><Label htmlFor="arabic-name">Arabic name</Label><Input id="arabic-name" name="full_name_ar" className="mt-1" /></div>
          <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" className="mt-1" /></div>
          <div>
            <Label htmlFor="team">Team</Label>
            <select id="team" name="team_id" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Individual athlete</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="sport">Sport</Label>
            <select id="sport" name="sport" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Select sport</option>
              {SPORTS.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}
            </select>
          </div>
          <div><Label htmlFor="position">Position</Label><Input id="position" name="position" placeholder="e.g. GK, RB" className="mt-1" /></div>
          <div><Label htmlFor="birth-year">Birth year</Label><Input id="birth-year" name="birth_year" type="number" min="1990" max="2020" placeholder="e.g. 2006" className="mt-1" /></div>
        </div>
      </section>

      {/* Body measurements */}
      <section className="grid gap-4">
        <h3 className="font-semibold tracking-tight border-b pb-2">Body measurements</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="height">Height (cm)</Label><Input id="height" name="height_cm" type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className="mt-1" /></div>
          <div><Label htmlFor="weight">Weight (kg)</Label><Input id="weight" name="weight_kg" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1" /></div>
          <div><Label htmlFor="body-fat">Body fat (%)</Label><Input id="body-fat" name="body_fat_pct" type="number" step="0.1" className="mt-1" /></div>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm"><span className="text-muted-foreground">BMI</span><strong className="ml-2">{bmi}</strong></div>
        </div>
      </section>

      {/* FMS */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-3 border-b pb-2">
          <h3 className="font-semibold tracking-tight">FMS Assessment</h3>
          <span className="text-sm text-muted-foreground">Total: {fmsTotal}/21</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FMS_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <Label htmlFor={key}>{label}</Label>
              <select
                id={key}
                name={key}
                value={fmsScores[key] ?? ""}
                onChange={(e) => setFmsScores((prev) => ({ ...prev, [key]: e.target.value }))}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">— not assessed —</option>
                {FMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Performance tests */}
      <section className="grid gap-4">
        <h3 className="font-semibold tracking-tight border-b pb-2">Performance tests</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERFORMANCE_FIELDS.map(({ key, label, unit }) => (
            <div key={key}>
              <Label htmlFor={key}>{label}{unit ? ` (${unit})` : ""}</Label>
              <Input id={key} name={key} type="number" step="0.01" className="mt-1" />
            </div>
          ))}
        </div>
      </section>

      {/* Strength — kg + reps → Epley 1RM */}
      <section className="grid gap-4">
        <div className="border-b pb-2">
          <h3 className="font-semibold tracking-tight">Strength</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enter weight lifted and reps performed. 1RM will be estimated using the Epley formula.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {STRENGTH_FIELDS.map(({ key, label }) => {
            const inputs = strengthInputs[key] ?? { kg: "", reps: "" }
            const estimated1rm = Number(inputs.kg) > 0 && Number(inputs.reps) > 0
              ? epley1RM(Number(inputs.kg), Number(inputs.reps))
              : null
            return (
              <div key={key} className="rounded-lg border p-3 grid gap-2">
                <p className="text-sm font-medium">{label}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`${key}_kg`} className="text-xs">Weight (kg)</Label>
                    <Input
                      id={`${key}_kg`}
                      type="number"
                      step="0.5"
                      min="0"
                      value={inputs.kg}
                      onChange={(e) => updateStrength(key, "kg", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${key}_reps`} className="text-xs">Reps</Label>
                    <Input
                      id={`${key}_reps`}
                      type="number"
                      step="1"
                      min="1"
                      value={inputs.reps}
                      onChange={(e) => updateStrength(key, "reps", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                {estimated1rm != null && (
                  <p className="text-xs text-muted-foreground">
                    Estimated 1RM: <strong className="text-foreground">{estimated1rm} kg</strong>
                  </p>
                )}
                {/* hidden field for the action */}
                <input type="hidden" name={`${key}_1rm_kg`} value={estimated1rm ?? ""} />
              </div>
            )
          })}
        </div>
      </section>

      {/* Notes */}
      <div>
        <Label htmlFor="coach-notes">Coach notes</Label>
        <textarea id="coach-notes" name="coach_notes" className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>

      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}

      <Button type="submit">Create athlete</Button>
    </form>
  )
}
