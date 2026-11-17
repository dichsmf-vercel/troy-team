"use client"

import { useState } from "react"
import { Copy, CheckCheck, Plus, Trash2, SlidersHorizontal, Sparkles } from "lucide-react"
import { createAthleteAccount } from "@/app/admin/actions/athletes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { AdminTeam } from "@/lib/admin/types"
import { getPerformanceRag } from "@/lib/rag-thresholds"
import { tx } from "@/lib/i18n/translate"
import { useT, useLn } from "@/components/providers/language-provider"

// FMS: 0 = ضعيف جدا, 1 = ضعيف, 2 = جيد/متوسط, 3 = ممتاز
const FMS_OPTIONS = [
  { value: "0", label: "0 – ضعيف جدا" },
  { value: "1", label: "1 – ضعيف" },
  { value: "2", label: "2 – جيد / متوسط" },
  { value: "3", label: "3 – ممتاز" },
]

const FMS_FIELDS: { key: string; label: string }[] = [
  { key: "deep_squat", label: tx("Deep Squat") },
  { key: "hurdle_step", label: tx("Hurdle Step") },
  { key: "inline_lunge", label: tx("Inline Lunge") },
  { key: "shoulder_mobility", label: tx("Shoulder Mobility") },
  { key: "active_straight_leg_raise", label: tx("Active Straight-Leg Raise") },
  { key: "trunk_stability", label: tx("Trunk Stability Push-Up") },
  { key: "rotary_stability", label: tx("Rotary Stability") },
]

const PERFORMANCE_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "v_jump_cm", label: tx("Vertical Jump"), unit: "cm" },
  { key: "sprint_30m_seconds", label: tx("30m Sprint"), unit: "sec" },
  { key: "t_test_seconds", label: tx("T-Test"), unit: "sec" },
  { key: "beep_test_level", label: tx("Beep Test Level"), unit: "" },
  { key: "beep_test_vo2_max", label: tx("Beep Test VO₂ Max"), unit: "" },
  { key: "star_balance", label: tx("Star Balance"), unit: "" },
  { key: "agility_rshaqah_seconds", label: tx("Agility (Rshaqah)"), unit: "sec" },
]

// Strength: kg + reps for Epley 1RM estimation
const STRENGTH_FIELDS: { key: string; label: string }[] = [
  { key: "squat", label: tx("Back Squat") },
  { key: "bench_press", label: tx("Bench Press") },
  { key: "deadlift", label: tx("Deadlift") },
  { key: "power_clean", label: tx("Power Clean") },
  { key: "shoulder_press", label: tx("Shoulder Press") },
]

const SPORTS = [tx("Handball"), tx("Football"), tx("Basketball"), tx("Volleyball"), tx("Hockey"), tx("Swimming"), tx("Athletics"), tx("Other")]
const DAY_NAMES = [tx("Sun"), tx("Mon"), tx("Tue"), tx("Wed"), tx("Thu"), tx("Fri"), tx("Sat")]

type CreatedAthlete = { troyId: string; temporaryPassword: string; name: string }
type CustomField = { id: string; name: string; value: string }

function epley1RM(kg: number, reps: number): number {
  if (reps === 1) return kg
  return Math.round(kg * (1 + reps / 30))
}

export function AthleteCreateForm({ teams = [] }: { teams: AdminTeam[] }) {
  const t = useT()
  const ln = useLn()
  const [message, setMessage] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedAthlete | null>(null)
  const [copied, setCopied] = useState<"id" | "pass" | null>(null)
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [fmsScores, setFmsScores] = useState<Record<string, string>>({})
  const [perfValues, setPerfValues] = useState<Record<string, string>>({})
  const [strengthInputs, setStrengthInputs] = useState<Record<string, { kg: string; reps: string }>>({})

  // Preferences
  const [selectedFreeDays, setSelectedFreeDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [hasProgram, setHasProgram] = useState(true)
  const [showRecap, setShowRecap] = useState(true)

  // Custom fields per section
  const [customFields, setCustomFields] = useState<Record<string, CustomField[]>>({
    account: [],
    measurements: [],
    fms: [],
    performance: [],
    strength: [],
    preferences: [],
  })

  const bmi = Number(height) > 0 && Number(weight) > 0
    ? (Number(weight) / ((Number(height) / 100) ** 2)).toFixed(1)
    : "—"
  const fmsTotal = Object.values(fmsScores).reduce((t, v) => t + (v === "" ? 0 : Number(v)), 0)
  const fmsRag = fmsTotal > 0 ? getPerformanceRag("fms_total", fmsTotal) : null

  function updateStrength(field: string, part: "kg" | "reps", value: string) {
    setStrengthInputs((prev) => ({ ...prev, [field]: { ...prev[field], [part]: value } }))
  }

  function toggleDay(day: number) {
    setSelectedFreeDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  function addCustomField(section: string) {
    const newField: CustomField = {
      id: crypto.randomUUID(),
      name: "",
      value: "",
    }
    setCustomFields((prev) => ({
      ...prev,
      [section]: [...(prev[section] ?? []), newField],
    }))
  }

  function updateCustomField(section: string, id: string, key: "name" | "value", text: string) {
    setCustomFields((prev) => ({
      ...prev,
      [section]: (prev[section] ?? []).map((f) => (f.id === id ? { ...f, [key]: text } : f)),
    }))
  }

  function removeCustomField(section: string, id: string) {
    setCustomFields((prev) => ({
      ...prev,
      [section]: (prev[section] ?? []).filter((f) => f.id !== id),
    }))
  }

  function copy(text: string, type: "id" | "pass") {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleSubmit(form: FormData) {
    setMessage(t("Creating athlete…"))
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

    // Explicitly append free days
    form.delete("free_training_days")
    for (const day of selectedFreeDays) {
      form.append("free_training_days", String(day))
    }

    form.set("has_program", String(hasProgram))
    form.set("show_exercise_recap", String(showRecap))

    // Collect custom fields into coach notes if any
    const allCustom = Object.entries(customFields).flatMap(([sec, fields]) =>
      fields.filter((f) => f.name.trim()).map((f) => `[${sec.toUpperCase()}] ${f.name.trim()}: ${f.value.trim()}`)
    )
    if (allCustom.length > 0) {
      const existingNotes = String(form.get("coach_notes") || "").trim()
      form.set("coach_notes", [existingNotes, ...allCustom].filter(Boolean).join("\n"))
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
            <p className="font-semibold">{t("{name} created", { name: created.name })}</p>
            <p className="text-sm text-muted-foreground">{t("Share these credentials with the athlete. They will be asked to set a new password on first login.")}</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("Troy ID (login)")}</p>
              <p className="mt-0.5 font-mono text-lg font-bold tracking-widest">{created.troyId}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copy(created.troyId, "id")} className="gap-1.5 shrink-0">
              {copied === "id" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === "id" ? t("Copied") : t("Copy")}
            </Button>
          </div>
          <div className="border-t pt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("Temporary password")}</p>
              <p className="mt-0.5 font-mono text-sm font-semibold">{created.temporaryPassword}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copy(created.temporaryPassword, "pass")} className="gap-1.5 shrink-0">
              {copied === "pass" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === "pass" ? t("Copied") : t("Copy")}
            </Button>
          </div>
        </div>

        <Badge variant="secondary" className="w-fit text-amber-700 bg-amber-500/10">
          {t("Save this password now — it won't be shown again")}
        </Badge>

        <Button variant="outline" onClick={() => setCreated(null)}>{t("Create another athlete")}</Button>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="grid gap-6 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">{t("Create athlete account")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("A Troy ID and temporary password will be generated automatically. Configure preferences, assessment metrics, and custom fields.")}
        </p>
      </div>

      {/* Account */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-semibold tracking-tight">{t("Account info")}</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addCustomField("account")}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3" /> {t("Custom field")}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="full-name">{t("Full name *")}</Label><Input id="full-name" name="full_name" required className="mt-1" /></div>
          <div><Label htmlFor="arabic-name">{t("Arabic name")}</Label><Input id="arabic-name" name="full_name_ar" className="mt-1" /></div>
          <div><Label htmlFor="phone">{t("Phone")}</Label><Input id="phone" name="phone" className="mt-1" /></div>
          <div>
            <Label htmlFor="team">{t("Team / Club")}</Label>
            <select id="team" name="team_id" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">{t("Individual athlete")}</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{ln(t.name_en, t.name_ar)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="sport">{t("Sport")}</Label>
            <select id="sport" name="sport" defaultValue="handball" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">{t("Select sport")}</option>
              {SPORTS.map((s) => <option key={s} value={s.toLowerCase()}>{t(s)}</option>)}
            </select>
          </div>
          <div><Label htmlFor="position">{t("Position")}</Label><Input id="position" name="position" placeholder={t("e.g. GK, RB, Pivot")} className="mt-1" /></div>
          <div><Label htmlFor="birth-year">{t("Birth year")}</Label><Input id="birth-year" name="birth_year" type="number" min="1980" max="2025" placeholder="e.g. 2006" className="mt-1" /></div>
        </div>

        {/* Custom fields for account */}
        {customFields.account.length > 0 && (
          <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("Custom Account Fields")}</p>
            {customFields.account.map((field) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder={t("Field label (e.g. National ID)")}
                  value={field.name}
                  onChange={(e) => updateCustomField("account", field.id, "name", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t("Value")}
                  value={field.value}
                  onChange={(e) => updateCustomField("account", field.id, "value", e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField("account", field.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Preferences Section */}
      <section className="grid gap-4 rounded-xl border bg-muted/15 p-4">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            <h3 className="font-semibold tracking-tight">{t("Athlete Preferences & Configuration")}</h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addCustomField("preferences")}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3" /> {t("Custom field")}
          </Button>
        </div>

        {/* Free training days */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{t("Available Training Days")}</Label>
            <span className="text-xs text-muted-foreground">
              {t.plural(selectedFreeDays.length, "{count} day selected", "{count} days selected")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("Select days the athlete is available. Program scheduling will match these days.")}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {DAY_NAMES.map((dayName, idx) => {
              const name = t(dayName)
              const active = selectedFreeDays.includes(idx)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Program Generation Toggle */}
        <div className="grid gap-3 pt-2">
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3">
            <div>
              <p className="text-sm font-semibold">{t("Monthly Program Assignment")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasProgram
                  ? t("Standard mode: Athlete receives monthly 4-week structured training programs.")
                  : t("No program assigned: Athlete will only train using individually assigned daily workouts.")}
              </p>
            </div>
            <select
              value={hasProgram ? "true" : "false"}
              onChange={(e) => setHasProgram(e.target.value === "true")}
              className="h-9 rounded-md border bg-background px-3 text-xs font-medium"
            >
              <option value="true">{t("Enable Program")}</option>
              <option value="false">{t("No Program Assigned")}</option>
            </select>
          </div>

          {/* Exercise Recap Toggle */}
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3">
            <div>
              <p className="text-sm font-semibold">{t("Session Exercise Recap")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Display the \"This is all the exercises you did today\" overview before the feedback form.")}
              </p>
            </div>
            <select
              value={showRecap ? "true" : "false"}
              onChange={(e) => setShowRecap(e.target.value === "true")}
              className="h-9 rounded-md border bg-background px-3 text-xs font-medium"
            >
              <option value="true">{t("Allowed (Enabled)")}</option>
              <option value="false">{t("Forbidden (Disabled)")}</option>
            </select>
          </div>
        </div>

        {/* Custom fields for preferences */}
        {customFields.preferences.length > 0 && (
          <div className="grid gap-2 rounded-lg border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("Custom Preferences")}</p>
            {customFields.preferences.map((field) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder={t("Preference label")}
                  value={field.name}
                  onChange={(e) => updateCustomField("preferences", field.id, "name", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t("Value")}
                  value={field.value}
                  onChange={(e) => updateCustomField("preferences", field.id, "value", e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField("preferences", field.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Body measurements */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-semibold tracking-tight">{t("Body measurements")}</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addCustomField("measurements")}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3" /> {t("Custom field")}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="height">{t("Height (cm)")}</Label><Input id="height" name="height_cm" type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className="mt-1" /></div>
          <div><Label htmlFor="weight">{t("Weight (kg)")}</Label><Input id="weight" name="weight_kg" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1" /></div>
          <div><Label htmlFor="body-fat">{t("Body fat (%)")}</Label><Input id="body-fat" name="body_fat_pct" type="number" step="0.1" className="mt-1" /></div>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm flex items-center justify-between sm:col-span-3">
            <span className="text-muted-foreground">{t("Calculated Body Mass Index (BMI)")}</span>
            <strong className="text-base font-bold">{bmi}</strong>
          </div>
        </div>

        {customFields.measurements.length > 0 && (
          <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("Custom Measurement Fields")}</p>
            {customFields.measurements.map((field) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder={t("Metric label (e.g. Arm Span cm)")}
                  value={field.name}
                  onChange={(e) => updateCustomField("measurements", field.id, "name", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t("Value")}
                  value={field.value}
                  onChange={(e) => updateCustomField("measurements", field.id, "value", e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField("measurements", field.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FMS */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold tracking-tight">{t("FMS Assessment")}</h3>
            {fmsRag && (
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${fmsRag.badgeClass}`}>
                {t(fmsRag.label)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t("Total: {fmsTotal}/21", { fmsTotal })}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => addCustomField("fms")}
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3" /> {t("Custom field")}
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FMS_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <Label htmlFor={key}>{t(label)}</Label>
              <select
                id={key}
                name={key}
                value={fmsScores[key] ?? ""}
                onChange={(e) => setFmsScores((prev) => ({ ...prev, [key]: e.target.value }))}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">{t("— not assessed —")}</option>
                {FMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {customFields.fms.length > 0 && (
          <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("Custom FMS Fields")}</p>
            {customFields.fms.map((field) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder={t("Test label")}
                  value={field.name}
                  onChange={(e) => updateCustomField("fms", field.id, "name", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t("Score / Notes")}
                  value={field.value}
                  onChange={(e) => updateCustomField("fms", field.id, "value", e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField("fms", field.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Performance tests with live RAG Threshold coloring */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h3 className="font-semibold tracking-tight">{t("Performance tests")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("Live RAG indicators highlight Low (Red), Moderate (Amber), and Good (Green) ranges.")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addCustomField("performance")}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3" /> {t("Custom field")}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERFORMANCE_FIELDS.map(({ key, label, unit }) => {
            const val = perfValues[key] ?? ""
            const rag = getPerformanceRag(key, val)
            return (
              <div key={key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={key} className="text-xs font-semibold">
                    {t(label)}{unit ? ` (${unit})` : ""}
                  </Label>
                  {rag && (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rag.badgeClass}`}>
                      {t(rag.label)}
                    </span>
                  )}
                </div>
                <Input
                  id={key}
                  name={key}
                  type="number"
                  step="0.01"
                  value={val}
                  onChange={(e) => setPerfValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="mt-2"
                  placeholder="0.00"
                />
              </div>
            )
          })}
        </div>

        {customFields.performance.length > 0 && (
          <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("Custom Performance Fields")}</p>
            {customFields.performance.map((field) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder={t("Test label (e.g. 10m sprint, pushups)")}
                  value={field.name}
                  onChange={(e) => updateCustomField("performance", field.id, "name", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t("Value / Unit")}
                  value={field.value}
                  onChange={(e) => updateCustomField("performance", field.id, "value", e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField("performance", field.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Strength — kg + reps → Epley 1RM */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h3 className="font-semibold tracking-tight">{t("Strength & 1RM Estimation")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("Enter weight lifted and reps performed. 1RM will be estimated using the Epley formula: 1RM = Weight × (1 + Reps/30).")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addCustomField("strength")}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3" /> {t("Custom field")}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {STRENGTH_FIELDS.map(({ key, label }) => {
            const inputs = strengthInputs[key] ?? { kg: "", reps: "" }
            const estimated1rm = Number(inputs.kg) > 0 && Number(inputs.reps) > 0
              ? epley1RM(Number(inputs.kg), Number(inputs.reps))
              : null
            return (
              <div key={key} className="rounded-lg border p-3 grid gap-2">
                <p className="text-sm font-medium">{t(label)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`${key}_kg`} className="text-xs">{t("Weight (kg)")}</Label>
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
                    <Label htmlFor={`${key}_reps`} className="text-xs">{t("Reps")}</Label>
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
                    {t("Estimated 1RM:")} <strong className="text-foreground">{t("{estimated1rm} kg", { estimated1rm })}</strong>
                  </p>
                )}
                <input type="hidden" name={`${key}_1rm_kg`} value={estimated1rm ?? ""} />
              </div>
            )
          })}
        </div>

        {customFields.strength.length > 0 && (
          <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("Custom Strength Exercises")}</p>
            {customFields.strength.map((field) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder={t("Exercise name (e.g. Trap Bar Deadlift)")}
                  value={field.name}
                  onChange={(e) => updateCustomField("strength", field.id, "name", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t("Weight & reps / 1RM")}
                  value={field.value}
                  onChange={(e) => updateCustomField("strength", field.id, "value", e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField("strength", field.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notes */}
      <div>
        <Label htmlFor="coach-notes">{t("Coach notes & Injury history")}</Label>
        <textarea
          id="coach-notes"
          name="coach_notes"
          placeholder={t("Add any specific injury notes, target goals, or physical accommodations...")}
          className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        {t("Create athlete")}
      </Button>
    </form>
  )
}
