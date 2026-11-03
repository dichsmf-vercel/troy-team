"use client"

import { useState, useTransition } from "react"
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
  ShieldOff,
  Trash2,
  UserRound,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  generateTemporaryAthletePassword,
  toggleAthleteAccountStatus,
  permanentlyDeleteAthlete,
  updateAthleteSettings,
  markExerciseSelfieReviewed,
  reviewSessionSelfie,
} from "@/app/admin/actions"
import type { AthleteSessionSummary, AthleteExercisePain } from "@/components/admin/athlete-feedback-panel"

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
  athlete: any
  selfies: Selfie[]
  summaries: AthleteSessionSummary[]
  painReports: AthleteExercisePain[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function rpeColor(rpe: number | null) {
  if (rpe == null) return "text-muted-foreground"
  if (rpe >= 8) return "text-red-500"
  if (rpe >= 6) return "text-amber-500"
  return "text-emerald-500"
}

function severityColor(s: number | null) {
  if (s == null) return "text-muted-foreground"
  if (s >= 7) return "text-red-500"
  if (s >= 4) return "text-amber-500"
  return "text-emerald-500"
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value ?? "—"}</p>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function AthleteDrawer({
  athlete,
  selfies,
  summaries,
  painReports,
  open,
  onOpenChange,
}: AthleteDrawerProps) {
  const [msg, setMsg] = useState<string | null>(null)
  const [tmpPassword, setTmpPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState<"id" | "pass" | null>(null)
  const [selfieItems, setSelfieItems] = useState<Selfie[]>(selfies)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Sync selfie list when prop changes (e.g. parent re-renders)
  // We keep local state so we can remove reviewed selfies optimistically
  const athleteSelfies = selfieItems.filter((s) => s.athlete_id === athlete.id)

  const profile = athlete.profiles ?? {}
  const name = profile.full_name ?? athlete.full_name ?? "Unnamed athlete"
  const troyId = profile.troy_id ?? null
  const team = athlete.athlete_teams?.[0]?.teams
  const height = athlete.height_cm ?? athlete.latest_measurement?.height_cm
  const weight = athlete.weight_kg ?? athlete.latest_measurement?.weight_kg
  const bmi = height && weight ? (weight / ((height / 100) ** 2)).toFixed(1) : null
  const isPaused = athlete.account_status === "paused"

  const athleteSummaries = summaries.filter((s) => s.athlete_id === athlete.id)
  const athletePain = painReports.filter((p) => p.athlete_id === athlete.id)

  // Average RPE across submitted summaries
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
        console.log("[Athlete-Drawer] Generating temporary password for athlete:", athlete.id)
        const result = await generateTemporaryAthletePassword(athlete.id)
        if (result.error) {
          console.error("[Athlete-Drawer] Password reset error:", result.error)
          setMsg(result.error)
          return
        }
        setTmpPassword(result.temporaryPassword ?? null)
        setMsg("Temporary password generated. Copy it — it won't appear again.")
      } catch (err: any) {
        console.error("[Athlete-Drawer] Unexpected error in handleResetPassword:", err)
        setMsg(err?.message?.includes("Server Action") ? "App was updated. Please refresh the page." : "Failed to reset password.")
      }
    })
  }

  function handleTogglePause() {
    const next = isPaused ? "active" : "paused"
    startTransition(async () => {
      try {
        console.log("[Athlete-Drawer] Toggling account status to:", next)
        const result = await toggleAthleteAccountStatus(athlete.id, next)
        setMsg(result.error ?? `Account ${next}.`)
      } catch (err: any) {
        console.error("[Athlete-Drawer] Unexpected error in handleTogglePause:", err)
        setMsg(err?.message?.includes("Server Action") ? "App was updated. Please refresh the page." : "Failed to update account status.")
      }
    })
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Permanently delete ${name}? This removes the account, assessments, measurements, programs, sessions, and all uploaded data. This cannot be undone.`
      )
    )
      return
    startTransition(async () => {
      try {
        console.log("[Athlete-Drawer] Permanently deleting athlete:", athlete.id)
        const result = await permanentlyDeleteAthlete(athlete.id)
        if (result.error) {
          console.error("[Athlete-Drawer] Delete error:", result.error)
          setMsg(result.error)
          return
        }
        onOpenChange(false)
      } catch (err: any) {
        console.error("[Athlete-Drawer] Unexpected error in handleDelete:", err)
        setMsg(err?.message?.includes("Server Action") ? "App was updated. Please refresh the page." : "Failed to delete athlete.")
      }
    })
  }

  async function handleSelfieReview(selfie: Selfie) {
    try {
      console.log("[Athlete-Drawer] Reviewing selfie:", { id: selfie.id, type: selfie.selfie_type })
      if (selfie.selfie_type === "program") {
        await markExerciseSelfieReviewed(selfie.id)
      } else {
        await reviewSessionSelfie(selfie.id)
      }
      setSelfieItems((current) => current.filter((s) => s.id !== selfie.id))
    } catch (err: any) {
      console.error("[Athlete-Drawer] Unexpected error reviewing selfie:", err)
      setMsg(err?.message?.includes("Server Action") ? "App was updated. Please refresh the page." : "Failed to review selfie.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl p-0"
        aria-label={`${name} athlete profile`}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <SheetHeader className="sticky top-0 z-10 border-b bg-popover px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <UserRound className="size-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base font-semibold">{name}</SheetTitle>
              <SheetDescription className="truncate text-xs">
                {troyId ?? athlete.auth_email ?? "—"}
              </SheetDescription>
            </div>
            {isPaused && (
              <Badge variant="secondary" className="ml-auto shrink-0 bg-amber-500/10 text-amber-700">
                Paused
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="grid gap-6 px-5 py-5">

          {/* ── Quick stats ─────────────────────────────────────────── */}
          <section className="grid grid-cols-3 gap-3 rounded-xl border bg-muted/30 p-4">
            <Stat label="Height" value={height ? `${height} cm` : null} />
            <Stat label="Weight" value={weight ? `${weight} kg` : null} />
            <Stat label="BMI" value={bmi ?? null} />
            <Stat label="Sport" value={athlete.sport ? String(athlete.sport).charAt(0).toUpperCase() + String(athlete.sport).slice(1) : null} />
            <Stat label="Position" value={athlete.position ?? null} />
            <Stat label="Birth year" value={athlete.birth_year ?? null} />
            <Stat label="Team" value={team?.name_en ?? "Individual"} />
            <Stat label="Tier" value={athlete.tier ?? null} />
            <Stat label="Assessment" value={athlete.assessment_status?.replaceAll("_", " ") ?? null} />
            {avgRpe && (
              <Stat
                label="Avg RPE"
                value={<span className={rpeColor(Number(avgRpe))}>{avgRpe}</span>}
              />
            )}
            {athletePain.length > 0 && (
              <div className="col-span-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertTriangle className="size-3.5" />
                  {athletePain.length} pain report{athletePain.length === 1 ? "" : "s"}
                </p>
              </div>
            )}
          </section>

          {/* ── Troy ID credentials ────────────────────────────────── */}
          {troyId && (
            <section className="grid gap-3 rounded-xl border p-4">
              <p className="text-sm font-semibold">Login credentials</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Troy ID</p>
                  <p className="font-mono text-sm font-bold tracking-widest">{troyId}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(troyId, "id")}
                  className="gap-1.5 shrink-0"
                >
                  {copied === "id" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied === "id" ? "Copied" : "Copy"}
                </Button>
              </div>
              {profile.password_change_required && (
                <Badge variant="secondary" className="w-fit bg-amber-500/10 text-amber-700">
                  Password change required on next login
                </Badge>
              )}
            </section>
          )}

          {/* ── Selfies ────────────────────────────────────────────── */}
          {athleteSelfies.length > 0 && (
            <section className="grid gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Exercise selfies</p>
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                  {athleteSelfies.length} unread
                </Badge>
              </div>
              <div className="grid gap-3">
                {athleteSelfies.map((selfie) => (
                  <div key={selfie.id} className="grid gap-3 rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {selfie.selfie_type === "program"
                            ? `Exercise ${(selfie.exercise_index ?? 0) + 1}`
                            : "Session exercise"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selfie.session_date ? `${selfie.session_date} · ` : ""}
                          Uploaded {new Date(selfie.uploaded_at).toLocaleString()}
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
                          alt={`${name} exercise selfie`}
                          className="aspect-video w-full object-cover transition-transform hover:scale-[1.02]"
                        />
                      </a>
                    ) : (
                      <div className="grid aspect-video place-items-center rounded-lg bg-muted text-sm text-muted-foreground">
                        Image unavailable
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
                      Mark reviewed and delete
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Feedback (collapsible) ─────────────────────────────── */}
          {(athleteSummaries.length > 0 || athletePain.length > 0) && (
            <section className="rounded-xl border">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-semibold"
                onClick={() => setFeedbackOpen((v) => !v)}
                aria-expanded={feedbackOpen}
              >
                <span className="flex items-center gap-2">
                  <HeartPulse className="size-4 text-muted-foreground" />
                  Session feedback
                  {athleteSummaries.length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({athleteSummaries.length} session{athleteSummaries.length === 1 ? "" : "s"})
                    </span>
                  )}
                </span>
                {feedbackOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>

              {feedbackOpen && (
                <div className="grid gap-4 border-t px-4 pb-4 pt-3">
                  {/* Pain reports */}
                  {athletePain.length > 0 && (
                    <div className="grid gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        <AlertTriangle className="size-3.5" />
                        Pain reports
                      </p>
                      {athletePain.map((pain) => (
                        <div key={pain.id} className="rounded-lg border border-red-200 bg-red-500/5 p-3 text-sm">
                          <p className="font-medium">{pain.exercise_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {pain.session_date} · {pain.session_title}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <span>Location: {pain.pain_location ?? "—"}</span>
                            <span className={severityColor(pain.pain_severity)}>
                              Severity: {pain.pain_severity ?? "—"}/10
                            </span>
                          </div>
                          {pain.pain_notes && (
                            <p className="mt-1 text-xs text-muted-foreground">{pain.pain_notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Session summaries */}
                  {athleteSummaries.length > 0 && (
                    <div className="grid gap-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Session summaries
                      </p>
                      {athleteSummaries.map((summary) => (
                        <div key={summary.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-xs truncate">{summary.session_title}</p>
                            <p className="shrink-0 text-xs text-muted-foreground">{summary.session_date}</p>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-4">
                            <span>
                              RPE:{" "}
                              <strong className={rpeColor(summary.rpe)}>
                                {summary.rpe ?? "—"}
                              </strong>
                            </span>
                            <span>Soreness: <strong>{summary.soreness_level ?? "—"}/5</strong></span>
                            <span>Sleep: <strong>{summary.sleep_quality ?? "—"}/5</strong></span>
                            <span>Rating: <strong>{summary.overall_rating ?? "—"}/5</strong></span>
                          </div>
                          {summary.symptoms && summary.symptoms.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Symptoms: {summary.symptoms.join(", ")}
                            </p>
                          )}
                          {summary.feedback_text && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
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

          {/* ── Settings (collapsible) ─────────────────────────────── */}
          <section className="rounded-xl border">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-semibold"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="size-4 text-muted-foreground" />
                Athlete settings
              </span>
              {settingsOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>

            {settingsOpen && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const form = new FormData(e.currentTarget)
                  startTransition(async () => {
                    const result = await updateAthleteSettings(form)
                    setMsg(result.error ?? "Settings saved.")
                  })
                }}
                className="grid gap-4 border-t px-4 pb-4 pt-3"
              >
                <input type="hidden" name="athlete_id" value={athlete.id} />

                {/* Free training days */}
                <div>
                  <Label className="mb-2 block text-sm">Free training days</Label>
                  <p className="mb-2 text-xs text-muted-foreground">Days the athlete is available to train (used for program scheduling).</p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_NAMES.map((day, i) => {
                      const isActive = (athlete.free_training_days ?? []).includes(i)
                      return (
                        <label key={i} className="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary">
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
                  {/* Hidden field: we'll collect checked values in the action */}
                </div>

                {/* Show exercise recap */}
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Show exercise recap</p>
                    <p className="text-xs text-muted-foreground">Display a full recap screen after the athlete completes all exercises.</p>
                  </div>
                  <select
                    name="show_exercise_recap"
                    defaultValue={String(athlete.show_exercise_recap ?? true)}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="true">On</option>
                    <option value="false">Off</option>
                  </select>
                </div>

                <Button type="submit" variant="secondary" disabled={isPending}>
                  {isPending ? "Saving…" : "Save settings"}
                </Button>
              </form>
            )}
          </section>

          {/* ── Controls ──────────────────────────────────────────── */}
          <section className="grid gap-3">
            <p className="text-sm font-semibold">Account controls</p>

            {/* Generate temp password */}
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleResetPassword}
              disabled={isPending}
            >
              <KeyRound className="size-4" />
              Generate temporary password
            </Button>

            {tmpPassword && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Temporary password</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold">{tmpPassword}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(tmpPassword, "pass")}
                    className="gap-1.5 shrink-0"
                  >
                    {copied === "pass" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied === "pass" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-amber-700">Save this now — it won't be shown again.</p>
              </div>
            )}

            {/* Pause / Resume */}
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={handleTogglePause}
              disabled={isPending}
            >
              {isPaused ? (
                <><PlayCircle className="size-4" />Resume account</>
              ) : (
                <><PauseCircle className="size-4" />Pause account</>
              )}
            </Button>

            {/* Delete */}
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="size-4" />
              Permanently delete athlete
            </Button>
          </section>

          {/* ── Status message ────────────────────────────────────── */}
          {msg && (
            <p role="status" className="text-xs text-muted-foreground">
              {msg}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
