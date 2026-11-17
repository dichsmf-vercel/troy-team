"use client"

import { firstRelation } from "@/lib/utils"
import { useMemo, useState, useTransition } from "react"
import {
  AlertTriangle,
  Calendar,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  HeartPulse,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Settings2,
  ShieldAlert,
  Trash2,
  UserRound,
  Activity,
  Dumbbell,
  SlidersHorizontal,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  generateTemporaryAthletePassword,
  toggleAthleteAccountStatus,
  permanentlyDeleteAthlete,
  updateAthleteSettings,
} from "@/app/admin/actions/athletes"
import { markExerciseSelfieReviewed, reviewSessionSelfie } from "@/app/admin/actions/selfies"
import { getPerformanceRag } from "@/lib/rag-thresholds"
import type { AthleteSessionSummary, AthleteExercisePain } from "@/components/admin/athlete-feedback-panel"
import type { AdminAthlete, AdminAthleteProfile } from "@/lib/admin/types"
import { useLn, useLanguage } from "@/components/providers/language-provider"
import { actionErrorMessage, isStaleActionError } from "@/lib/client-errors"
import { tx } from "@/lib/i18n/translate"

// ─── types ────────────────────────────────────────────────────────────────────

type Selfie = {
  id: string
  athlete_id: string
  session_date?: string
  exercise_index?: number
  uploaded_at: string
  image_url: string | null
  session_exercise_id?: string
  selfie_type: "program" | "session"
}

type AthleteDrawerProps = {
  athlete: AdminAthlete
  selfies: Selfie[]
  summaries: AthleteSessionSummary[]
  painReports: AthleteExercisePain[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DAY_NAMES = [tx("Sun"), tx("Mon"), tx("Tue"), tx("Wed"), tx("Thu"), tx("Fri"), tx("Sat")]

const FMS_AR_LABELS: Record<string, string> = {
  "0": "ضعيف جدا",
  "1": "ضعيف",
  "2": "جيد / متوسط",
  "3": "ممتاز",
}

const FMS_TESTS = [
  { key: "deep_squat", label: tx("Deep Squat") },
  { key: "hurdle_step", label: tx("Hurdle Step") },
  { key: "inline_lunge", label: tx("Inline Lunge") },
  { key: "shoulder_mobility", label: tx("Shoulder Mobility") },
  { key: "active_straight_leg_raise", label: tx("Active Straight-Leg Raise") },
  { key: "trunk_stability", label: tx("Trunk Stability") },
  { key: "rotary_stability", label: tx("Rotary Stability") },
]

const PERF_METRICS: { key: string; label: string; unit: string; ragEnabled?: boolean }[] = [
  { key: "v_jump_cm", label: tx("Vertical Jump"), unit: "cm" },
  { key: "horizontal_jump_cm", label: tx("Horizontal Jump"), unit: "cm", ragEnabled: false },
  { key: "sprint_30m_seconds", label: tx("30m Sprint"), unit: "sec" },
  { key: "sprint_20m_seconds", label: tx("20m Sprint"), unit: "sec", ragEnabled: false },
  { key: "agility_505_r_seconds", label: tx("505 Agility (R)"), unit: "sec", ragEnabled: false },
  { key: "agility_505_l_seconds", label: tx("505 Agility (L)"), unit: "sec", ragEnabled: false },
  { key: "t_test_seconds", label: tx("T-Test"), unit: "sec" },
  { key: "beep_test_level", label: tx("Beep Test Level"), unit: "" },
  { key: "beep_test_vo2_max", label: tx("Beep Test VO₂"), unit: "" },
  { key: "star_balance", label: tx("Star Balance"), unit: "" },
  { key: "agility_rshaqah_seconds", label: tx("Agility (Rshaqah)"), unit: "sec" },
  { key: "push_ups", label: tx("Push-ups"), unit: "reps", ragEnabled: false },
  { key: "pull_ups", label: tx("Pull-ups"), unit: "reps", ragEnabled: false },
  { key: "plank_seconds", label: tx("Plank Hold"), unit: "sec", ragEnabled: false },
  { key: "row_machine_result", label: tx("Row Machine (M)"), unit: "m", ragEnabled: false },
  { key: "row_machine_watts", label: tx("Row Machine (Watts)"), unit: "W", ragEnabled: false },
]

const STRENGTH_METRICS = [
  { key: "squat_1rm_kg", label: tx("Back Squat") },
  { key: "bench_press_1rm_kg", label: tx("Bench Press") },
  { key: "deadlift_1rm_kg", label: tx("Deadlift") },
  { key: "power_clean_1rm_kg", label: tx("Power Clean") },
  { key: "shoulder_press_1rm_kg", label: tx("Shoulder Press") },
]

function rpeColor(rpe: number | null) {
  if (rpe == null) return "text-muted-foreground"
  if (rpe >= 8) return "text-red-500 font-bold"
  if (rpe >= 6) return "text-amber-500 font-bold"
  return "text-emerald-500 font-bold"
}

function severityColor(s: number | null) {
  if (s == null) return "text-muted-foreground"
  if (s >= 7) return "text-red-500 font-bold"
  if (s >= 4) return "text-amber-500 font-bold"
  return "text-emerald-500 font-bold"
}

export function AthleteDrawer({
  athlete,
  selfies,
  summaries,
  painReports,
  open,
  onOpenChange,
}: AthleteDrawerProps) {
  const { t, locale } = useLanguage()
  const ln = useLn()
  const [msg, setMsg] = useState<string | null>(null)
  const [tmpPassword, setTmpPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState<"id" | "pass" | null>(null)
  const [selfieItems, setSelfieItems] = useState<Selfie[]>(selfies)
  const [isPending, startTransition] = useTransition()

  // Collapsible sections
  const [assessmentOpen, setAssessmentOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)

  const athleteSelfies = selfieItems.filter((s) => s.athlete_id === athlete.id)

  const profile: Partial<AdminAthleteProfile> = athlete.profiles ?? {}
  const name = profile.full_name ?? athlete.full_name ?? t("Unnamed athlete")
  const nameAr = profile.full_name_ar ?? null
  const troyId = profile.troy_id ?? null
  const team = firstRelation(athlete.athlete_teams?.[0]?.teams)
  const height = athlete.height_cm ?? athlete.latest_measurement?.height_cm
  const weight = athlete.weight_kg ?? athlete.latest_measurement?.weight_kg
  const bmi = height && weight ? (weight / ((height / 100) ** 2)).toFixed(1) : null
  const isPaused = athlete.account_status === "paused"
  const hasProgramSetting = !athlete.goals?.includes("Assigned exercises only")

  // Assessment answers map
  const answersMap = useMemo(() => {
    const map: Record<string, any> = {}
    for (const a of athlete.assessment_answers ?? []) {
      map[a.question_key] = a.answer_json?.value
    }
    return map
  }, [athlete.assessment_answers])

  const fmsTotal = answersMap.fms_total ?? null
  const fmsRag = fmsTotal != null ? getPerformanceRag("fms_total", fmsTotal) : null

  const athleteSummaries = summaries.filter((s) => s.athlete_id === athlete.id)
  const athletePain = painReports.filter((p) => p.athlete_id === athlete.id)

  const rpeValues = athleteSummaries.map((s) => s.rpe).filter((v): v is number => v != null)
  const avgRpe = rpeValues.length ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1) : null

  function copy(text: string, type: "id" | "pass") {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleResetPassword() {
    startTransition(async () => {
      setMsg(null)
      setTmpPassword(null)
      try {
        const result = await generateTemporaryAthletePassword(athlete.id)
        if (result.error) {
          console.error("[Athlete-Drawer] Password reset error:", result.error)
          setMsg(result.error)
          return
        }
        setTmpPassword(result.temporaryPassword ?? null)
        setMsg(t("Temporary password generated. Copy it — it won't appear again."))
      } catch (err) {
        console.error("[Athlete-Drawer] Unexpected error in handleResetPassword:", err)
        setMsg(isStaleActionError(err) ? t("App was updated. Please refresh the page.") : t("Failed to reset password."))
      }
    })
  }

  function handleTogglePause() {
    const next = isPaused ? "active" : "paused"
    startTransition(async () => {
      try {
        const result = await toggleAthleteAccountStatus(athlete.id, next)
        setMsg(result.error ?? t("Account {next}.", { next }))
      } catch (err) {
        console.error("[Athlete-Drawer] Unexpected error in handleTogglePause:", err)
        setMsg(isStaleActionError(err) ? t("App was updated. Please refresh the page.") : t("Failed to update account status."))
      }
    })
  }

  function handleDelete() {
    if (
      !window.confirm(
        t("Permanently delete {name}? This removes the account, assessments, measurements, programs, sessions, and all uploaded data. This cannot be undone.", { name })
      )
    )
      return
    startTransition(async () => {
      try {
        const result = await permanentlyDeleteAthlete(athlete.id)
        if (result.error) {
          console.error("[Athlete-Drawer] Delete error:", result.error)
          setMsg(result.error)
          return
        }
        onOpenChange(false)
      } catch (err) {
        console.error("[Athlete-Drawer] Unexpected error in handleDelete:", err)
        setMsg(isStaleActionError(err) ? t("App was updated. Please refresh the page.") : t("Failed to delete athlete."))
      }
    })
  }

  async function handleSelfieReview(selfie: Selfie) {
    try {
      if (selfie.selfie_type === "program") {
        await markExerciseSelfieReviewed(selfie.id)
      } else {
        await reviewSessionSelfie(selfie.id)
      }
      setSelfieItems((current) => current.filter((s) => s.id !== selfie.id))
    } catch (err) {
      console.error("[Athlete-Drawer] Unexpected error reviewing selfie:", err)
      setMsg(isStaleActionError(err) ? t("App was updated. Please refresh the page.") : t("Failed to review selfie."))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl p-0"
        aria-label={t("{name} athlete profile", { name })}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-bold">
              {team?.image_url ? (
                <img src={team.image_url} alt="" className="size-11 rounded-full object-cover" />
              ) : (
                <UserRound className="size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base font-semibold">
                {name} {nameAr ? <span className="text-xs text-muted-foreground font-normal">({nameAr})</span> : null}
              </SheetTitle>
              <SheetDescription className="truncate text-xs font-mono">
                {troyId ?? athlete.auth_email ?? "—"}
                {athlete.sport ? ` · ${String(athlete.sport).toUpperCase()}` : ""}
                {athlete.position ? ` · ${athlete.position}` : ""}
              </SheetDescription>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {isPaused ? (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                  {t("Paused")}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                  {t("Active")}
                </Badge>
              )}
              {!hasProgramSetting && (
                <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                  {t("Assigned Only")}
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="grid gap-5 px-4 py-5 sm:px-6">

          {/* ── Quick Stats Grid ─────────────────────────────────────────── */}
          <section className="grid grid-cols-2 gap-2.5 rounded-xl border bg-muted/20 p-3.5 sm:grid-cols-4">
            <div className="rounded-lg bg-card p-2.5 border">
              <p className="text-[11px] text-muted-foreground">{t("Height / Weight")}</p>
              <p className="mt-0.5 text-xs font-semibold">
                {height ? t("{height} cm", { height }) : "—"} · {weight ? t("{weight} kg", { weight }) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-card p-2.5 border">
              <p className="text-[11px] text-muted-foreground">{t("BMI")}</p>
              <p className="mt-0.5 text-xs font-semibold">{bmi ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-card p-2.5 border">
              <p className="text-[11px] text-muted-foreground">{t("Club / Team")}</p>
              <p className="mt-0.5 text-xs font-semibold truncate">{ln(team?.name_en, team?.name_ar) || t("Individual")}</p>
            </div>
            <div className="rounded-lg bg-card p-2.5 border">
              <p className="text-[11px] text-muted-foreground">{t("Birth Year")}</p>
              <p className="mt-0.5 text-xs font-semibold">{athlete.birth_year ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-card p-2.5 border">
              <p className="text-[11px] text-muted-foreground">{t("Program Mode")}</p>
              <p className="mt-0.5 text-xs font-semibold truncate">
                {hasProgramSetting ? t("Monthly Program") : t("Assigned Exercises")}
              </p>
            </div>
            <div className="rounded-lg bg-card p-2.5 border">
              <p className="text-[11px] text-muted-foreground">{t("Assessment")}</p>
              <p className="mt-0.5 text-xs font-semibold capitalize truncate">
                {athlete.assessment_status?.replaceAll("_", " ") ?? t("Draft")}
              </p>
            </div>
            <div className="rounded-lg bg-card p-2.5 border">
              <p className="text-[11px] text-muted-foreground">{t("Avg Session RPE")}</p>
              <p className="mt-0.5 text-xs font-semibold">
                {avgRpe ? <span className={rpeColor(Number(avgRpe))}>{avgRpe} / 10</span> : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-card p-2.5 border">
              <p className="text-[11px] text-muted-foreground">{t("Pain Reports")}</p>
              <p className="mt-0.5 text-xs font-semibold">
                {athletePain.length > 0 ? (
                  <span className="text-red-500 font-bold">{t("{athletePainCount} reported", { athletePainCount: athletePain.length })}</span>
                ) : (
                  <span className="text-emerald-500">{t("None")}</span>
                )}
              </p>
            </div>
          </section>

          {/* ── Troy ID credentials ────────────────────────────────── */}
          {troyId && (
            <section className="grid gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Troy ID Login")}</p>
                  <p className="mt-1 font-mono text-base font-bold tracking-widest text-primary">{troyId}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(troyId, "id")}
                  className="gap-1.5 shrink-0"
                >
                  {copied === "id" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied === "id" ? t("Copied") : t("Copy")}
                </Button>
              </div>
              {profile.password_change_required && (
                <p className="text-xs text-amber-700 bg-amber-500/10 rounded-md p-2">
                  {t("Athlete will be asked to set a personalized password on their next login.")}
                </p>
              )}
            </section>
          )}

          {/* ── Assessment & Performance Tests (Collapsible) ────────── */}
          <section className="rounded-xl border overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold hover:bg-muted/30"
              onClick={() => setAssessmentOpen((v) => !v)}
              aria-expanded={assessmentOpen}
            >
              <span className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                {t("Physical & Performance Tests")}
                {fmsRag && (
                  <span className={`rounded-full border px-2 py-0.2 text-[10px] font-semibold ${fmsRag.badgeClass}`}>
                    {t("FMS {fmsTotal}/21 · {label}", { fmsTotal, label: t(fmsRag.label) })}
                  </span>
                )}
              </span>
              {assessmentOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {assessmentOpen && (
              <div className="grid gap-4 border-t p-4">
                {/* Performance tests RAG cards */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {t("Performance Tests (RAG Indicator)")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PERF_METRICS.map(({ key, label, unit, ragEnabled = true }) => {
                      const val = answersMap[key] ?? null
                      const rag = ragEnabled && val != null ? getPerformanceRag(key, val) : null
                      return (
                        <div key={key} className="rounded-lg border bg-card p-2.5">
                          <p className="text-[11px] text-muted-foreground truncate">{t(label)}</p>
                          <p className="mt-1 text-sm font-bold">
                            {val != null ? `${val} ${unit}` : "—"}
                          </p>
                          {rag ? (
                            <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[9px] font-semibold ${rag.badgeClass}`}>
                              {t(rag.label)}
                            </span>
                          ) : (
                            <span className="mt-1.5 inline-block text-[9px] text-muted-foreground">
                              {val != null ? t("Recorded") : t("Not recorded")}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* FMS Details with Arabic labels */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("FMS Movement Screen")}
                    </p>
                    <span className="text-xs font-bold">{t("Total:")} {fmsTotal ?? "—"}/21</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {FMS_TESTS.map(({ key, label }) => {
                      const score = answersMap[key] != null ? String(answersMap[key]) : null
                      const arLabel = score != null ? FMS_AR_LABELS[score] : "غير مقيّم"
                      const scoreNum = score != null ? Number(score) : null
                      const scoreClass = scoreNum === 3 ? "text-emerald-600 font-bold" : scoreNum === 2 ? "text-amber-600 font-bold" : scoreNum != null ? "text-red-600 font-bold" : "text-muted-foreground"
                      return (
                        <div key={key} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs">
                          <span className="font-medium text-foreground">{t(label)}</span>
                          <span className={scoreClass}>
                            {score != null ? `${score} (${arLabel})` : "—"}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Strength 1RMs */}
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {t("Estimated 1RM Strength (Epley)")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {STRENGTH_METRICS.map(({ key, label }) => {
                      const val = answersMap[key] ?? null
                      return (
                        <div key={key} className="rounded-lg border bg-card p-2.5">
                          <p className="text-[11px] text-muted-foreground truncate">{t(label)}</p>
                          <p className="mt-1 text-sm font-bold text-foreground">
                            {val != null ? t("{val} kg", { val }) : "—"}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Settings (Collapsible) ─────────────────────────────── */}
          <section className="rounded-xl border overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold hover:bg-muted/30"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="size-4 text-muted-foreground" />
                {t("Athlete Settings & Preferences")}
              </span>
              {settingsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {settingsOpen && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const form = new FormData(e.currentTarget)
                  startTransition(async () => {
                    const result = await updateAthleteSettings(form)
                    setMsg(result.error ?? t("Settings saved successfully."))
                  })
                }}
                className="grid gap-4 border-t p-4"
              >
                <input type="hidden" name="athlete_id" value={athlete.id} />

                {/* Free training days */}
                <div>
                  <Label className="mb-1 block text-xs font-semibold">{t("Available Training Days")}</Label>
                  <p className="mb-2 text-xs text-muted-foreground">{t("Select days athlete is available for training:")}</p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_NAMES.map((dayKey, i) => {
                      const day = t(dayKey)
                      const isActive = (athlete.free_training_days ?? [0, 1, 2, 3, 4, 5, 6]).includes(i)
                      return (
                        <label key={i} className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary">
                          <input
                            type="checkbox"
                            name="free_training_days"
                            value={i}
                            defaultChecked={isActive}
                            className="sr-only"
                          />
                          {day}
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Program Assignment Toggle */}
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("Program Assignment")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("Enable monthly 4-week program or restrict to assigned daily exercises only.")}
                    </p>
                  </div>
                  <select
                    name="has_program"
                    defaultValue={hasProgramSetting ? "true" : "false"}
                    className="h-9 rounded-md border bg-background px-2 text-xs font-semibold"
                  >
                    <option value="true">{t("Enable Program")}</option>
                    <option value="false">{t("Assigned Only (No Program)")}</option>
                  </select>
                </div>

                {/* Show exercise recap */}
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("Session Exercise Recap")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("Display full summary screen after completing all exercises before feedback.")}
                    </p>
                  </div>
                  <select
                    name="show_exercise_recap"
                    defaultValue={String(athlete.show_exercise_recap ?? true)}
                    className="h-9 rounded-md border bg-background px-2 text-xs font-semibold"
                  >
                    <option value="true">{t("Allowed (On)")}</option>
                    <option value="false">{t("Forbidden (Off)")}</option>
                  </select>
                </div>

                {/* Sport & Position */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="drawer-sport" className="text-xs font-medium">{t("Sport")}</Label>
                    <Input id="drawer-sport" name="sport" defaultValue={athlete.sport ?? ""} placeholder={t("e.g. handball")} className="mt-1 h-9 text-xs" />
                  </div>
                  <div>
                    <Label htmlFor="drawer-position" className="text-xs font-medium">{t("Position")}</Label>
                    <Input id="drawer-position" name="position" defaultValue={athlete.position ?? ""} placeholder={t("e.g. GK, Pivot")} className="mt-1 h-9 text-xs" />
                  </div>
                </div>

                <Button type="submit" variant="default" disabled={isPending} className="w-full sm:w-auto">
                  {isPending ? t("Saving changes…") : t("Save settings")}
                </Button>
              </form>
            )}
          </section>

          {/* ── Exercise Selfies ────────────────────────────────────── */}
          {athleteSelfies.length > 0 && (
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t("Exercise selfies")}</p>
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                  {t("{athleteSelfiesCount} unread", { athleteSelfiesCount: athleteSelfies.length })}
                </Badge>
              </div>
              <div className="grid gap-3">
                {athleteSelfies.map((selfie) => (
                  <div key={selfie.id} className="grid gap-3 rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {selfie.selfie_type === "program"
                            ? t("Exercise {number}", { number: (selfie.exercise_index ?? 0) + 1 })
                            : t("Session exercise")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selfie.session_date ? `${selfie.session_date} · ` : ""}
                          {t("Uploaded")} {new Date(selfie.uploaded_at).toLocaleString(locale)}
                        </p>
                      </div>
                    </div>
                    {selfie.image_url ? (
                      <a
                        href={selfie.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg"
                      >
                        <img
                          src={selfie.image_url}
                          alt={t("{name} exercise selfie", { name })}
                          className="aspect-video w-full object-cover transition-transform hover:scale-[1.02]"
                        />
                      </a>
                    ) : (
                      <div className="grid aspect-video place-items-center rounded-lg bg-muted text-sm text-muted-foreground">
                        {t("Image unavailable")}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleSelfieReview(selfie)}
                    >
                      <CheckCheck className="size-4" />
                      {t("Mark reviewed and delete")}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Feedback & Pain (Collapsible) ─────────────────────────────── */}
          {(athleteSummaries.length > 0 || athletePain.length > 0) && (
            <section className="rounded-xl border overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold hover:bg-muted/30"
                onClick={() => setFeedbackOpen((v) => !v)}
                aria-expanded={feedbackOpen}
              >
                <span className="flex items-center gap-2">
                  <HeartPulse className="size-4 text-muted-foreground" />
                  {t("Session Feedback & Pain")}
                  {athletePain.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                      {t("{athletePainCount} pain", { athletePainCount: athletePain.length })}
                    </Badge>
                  )}
                </span>
                {feedbackOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>

              {feedbackOpen && (
                <div className="grid gap-4 border-t p-4">
                  {/* Pain reports */}
                  {athletePain.length > 0 && (
                    <div className="grid gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        <AlertTriangle className="size-3.5" />
                        {t("Pain reports")}
                      </p>
                      {athletePain.map((pain) => (
                        <div key={pain.id} className="rounded-lg border border-red-200 bg-red-500/5 p-3 text-sm">
                          <p className="font-semibold">{pain.exercise_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {pain.session_date} · {pain.session_title}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <span>{t("Location:")} <strong>{pain.pain_location ?? "—"}</strong></span>
                            <span className={severityColor(pain.pain_severity)}>
                              {t("Severity:")} {pain.pain_severity ?? "—"}/10
                            </span>
                          </div>
                          {pain.pain_notes && (
                            <p className="mt-1 text-xs text-muted-foreground italic">"{pain.pain_notes}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Session summaries */}
                  {athleteSummaries.length > 0 && (
                    <div className="grid gap-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("Recent Session Summaries")}
                      </p>
                      {athleteSummaries.slice(0, 5).map((summary) => (
                        <div key={summary.id} className="rounded-lg border p-3 text-sm bg-card">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-xs truncate">{summary.session_title}</p>
                            <p className="shrink-0 text-xs text-muted-foreground">{summary.session_date}</p>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-4">
                            <span>{t("RPE:")} <strong className={rpeColor(summary.rpe)}>{summary.rpe ?? "—"}</strong></span>
                            <span>{t("Soreness:")} <strong>{summary.soreness_level ?? "—"}/5</strong></span>
                            <span>{t("Sleep:")} <strong>{summary.sleep_quality ?? "—"}/5</strong></span>
                            <span>{t("Rating:")} <strong>{summary.overall_rating ?? "—"}/5</strong></span>
                          </div>
                          {summary.feedback_text && (
                            <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2">
                              "{summary.feedback_text}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Account Controls ──────────────────────────────────── */}
          <section className="grid gap-3 rounded-xl border p-4 bg-muted/10">
            <p className="text-sm font-semibold">{t("Account Controls & Security")}</p>

            {/* Generate temp password */}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 justify-start h-10"
              onClick={handleResetPassword}
              disabled={isPending}
            >
              <KeyRound className="size-4" />
              {t("Generate Temporary Password")}
            </Button>

            {tmpPassword && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("New Temporary Password")}</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{tmpPassword}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(tmpPassword, "pass")}
                    className="gap-1.5 shrink-0"
                  >
                    {copied === "pass" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied === "pass" ? t("Copied") : t("Copy")}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-amber-700">
                  {t("Athlete will be asked to create a new password on login. Copy it now.")}
                </p>
              </div>
            )}

            {/* Pause / Resume */}
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2 justify-start h-10"
              onClick={handleTogglePause}
              disabled={isPending}
            >
              {isPaused ? (
                <><PlayCircle className="size-4 text-emerald-600" />{t("Resume Athlete Account")}</>
              ) : (
                <><PauseCircle className="size-4 text-amber-600" />{t("Pause Athlete Account")}</>
              )}
            </Button>

            {/* Delete */}
            <Button
              type="button"
              variant="destructive"
              className="w-full gap-2 justify-start h-10"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="size-4" />
              {t("Permanently Delete Athlete")}
            </Button>
          </section>

          {/* ── Status message ────────────────────────────────────── */}
          {msg && (
            <p role="status" className="rounded-lg bg-muted/60 p-2.5 text-center text-xs font-medium text-foreground">
              {msg}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
