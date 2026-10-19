"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { Play, Check, TriangleAlert, ChevronLeft, ChevronRight, Camera, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Language } from "@/lib/i18n/dictionaries"
import { useLanguage } from "@/components/providers/language-provider"
import {
  startSession,
  toggleExerciseCompletion,
  reportPain,
  uploadExerciseSelfie,
  saveExerciseFeedback,
} from "@/app/(athlete)/session/[sessionPostId]/actions"
import { safeDate, safeTime } from "@/lib/formatters"

type Exercise = {
  sessionExerciseId: string
  exerciseId: string
  name: string
  description: string | null
  imageUrl: string | null
  videoUrl: string | null
  sets: number | null
  reps: string | null
}

type SelfieState = "idle" | "uploading" | "done" | "error"

export function SessionRunner({
  language,
  sessionPostId,
  title,
  notes,
  teamName,
  teamColor,
  isNationalTeam,
  sessionDate,
  period,
  exercises,
  initialSessionAthleteId,
  initialAttendedAt,
  initialCompletions,
  initialSelfieUploaded,
}: {
  language: Language
  sessionPostId: string
  title: string
  notes: string | null
  teamName: string
  teamColor: string
  isNationalTeam: boolean
  sessionDate: string
  period: string
  exercises: Exercise[]
  initialSessionAthleteId: string | null
  initialAttendedAt: string | null
  initialCompletions: { session_exercise_id: string; completed: boolean }[]
  initialSelfieUploaded: boolean
}) {
  const { dict } = useLanguage()

  // Session state
  const [sessionAthleteId, setSessionAthleteId] = useState(initialSessionAthleteId)
  const [attendedAt, setAttendedAt] = useState(initialAttendedAt)
  const [activeIndex, setActiveIndex] = useState(() => {
    // start on the first incomplete exercise
    const firstIncomplete = initialCompletions.findIndex((c) => !c.completed)
    return firstIncomplete >= 0 ? firstIncomplete : 0
  })
  const [completedSet, setCompletedSet] = useState<Set<string>>(
    new Set(initialCompletions.filter((c) => c.completed).map((c) => c.session_exercise_id)),
  )

  // Per-exercise selfie state
  const [selfieStates, setSelfieStates] = useState<Record<string, SelfieState>>({})
  const [selfieErrors, setSelfieErrors] = useState<Record<string, string>>({})

  // Pain dialog
  const [painDialogFor, setPainDialogFor] = useState<string | null>(null)
  const [painLocation, setPainLocation] = useState("")
  const [painSeverity, setPainSeverity] = useState(5)
  const [painNotes, setPainNotes] = useState("")

  // Video
  const [showVideo, setShowVideo] = useState(false)

  // General error / pending
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const active = exercises[activeIndex]
  const completedCount = completedSet.size
  const progressPct = exercises.length > 0 ? Math.round((completedCount / exercises.length) * 100) : 0
  const allDone = exercises.length > 0 && completedCount === exercises.length

  // ─── handlers ────────────────────────────────────────────────────────────────

  function handleStart() {
    startTransition(async () => {
      const result = await startSession(sessionPostId)
      if (result?.error) { setError(result.error); return }
      if (result?.sessionAthleteId) setSessionAthleteId(result.sessionAthleteId)
      if (!attendedAt) setAttendedAt(new Date().toISOString())
    })
  }

  function handleSelfieUpload(sessionExerciseId: string, file: File) {
    if (!sessionAthleteId) return
    setSelfieStates((prev) => ({ ...prev, [sessionExerciseId]: "uploading" }))
    setSelfieErrors((prev) => { const next = { ...prev }; delete next[sessionExerciseId]; return next })
    startTransition(async () => {
      const result = await uploadExerciseSelfie(sessionAthleteId, sessionExerciseId, file)
      if (result?.error) {
        setSelfieStates((prev) => ({ ...prev, [sessionExerciseId]: "error" }))
        setSelfieErrors((prev) => ({ ...prev, [sessionExerciseId]: result.error! }))
      } else {
        setSelfieStates((prev) => ({ ...prev, [sessionExerciseId]: "done" }))
      }
    })
  }

  function handleCompleteExercise(sessionExerciseId: string) {
    if (!sessionAthleteId) return
    if (selfieStates[sessionExerciseId] !== "done") {
      setSelfieErrors((prev) => ({ ...prev, [sessionExerciseId]: "Upload a selfie first to mark this exercise complete." }))
      return
    }
    startTransition(async () => {
      const result = await toggleExerciseCompletion(sessionAthleteId, sessionExerciseId, true)
      if (result?.error) { setError(result.error); return }
      setCompletedSet((prev) => new Set([...prev, sessionExerciseId]))
      // auto-advance to next incomplete
      const nextIndex = exercises.findIndex(
        (ex, idx) => idx > activeIndex && !completedSet.has(ex.sessionExerciseId) && ex.sessionExerciseId !== sessionExerciseId,
      )
      if (nextIndex >= 0) setActiveIndex(nextIndex)
      else if (activeIndex < exercises.length - 1) setActiveIndex(activeIndex + 1)
    })
  }

  function handleReportPain() {
    if (!sessionAthleteId || !painDialogFor) return
    startTransition(async () => {
      await reportPain(sessionAthleteId, painDialogFor, {
        location: painLocation,
        severity: painSeverity,
        notes: painNotes,
      })
      setPainDialogFor(null)
      setPainLocation("")
      setPainSeverity(5)
      setPainNotes("")
    })
  }

  // ─── pre-start screen ────────────────────────────────────────────────────────

  if (!attendedAt) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <Badge className="border-0 text-primary-foreground" style={{ backgroundColor: teamColor }}>
          {teamName}
        </Badge>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
        {notes ? <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{notes}</p> : null}
        <p className="text-sm text-muted-foreground tabular">
          {safeDate(sessionDate, language === "ar" ? "ar" : "en-US", { weekday: "long", month: "long", day: "numeric" })}{" "}
          &middot; {safeTime(period, language === "ar" ? "ar" : "en-US")}
        </p>
        <div className="w-full max-w-sm rounded-2xl border border-dashed p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to expect</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            <li>· {exercises.length} exercises to complete</li>
            <li>· Upload a selfie after each exercise</li>
            <li>· Report any pain or discomfort as you go</li>
          </ul>
        </div>
        {error ? (
          <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : null}
        <Button
          size="lg"
          className="h-14 w-full max-w-sm gap-3 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
          onClick={handleStart}
          disabled={isPending}
        >
          <Play className="size-4" />
          {isPending ? "Starting…" : dict.session.startSession ?? "Start session"}
        </Button>
      </div>
    )
  }

  // ─── done screen ─────────────────────────────────────────────────────────────

  if (allDone) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Check className="size-8" />
        </div>
        <h1 className="text-2xl font-semibold">All exercises done!</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Great work. Submit your session summary so your coach can review your feedback.
        </p>
        <Button size="lg" className="w-full max-w-sm gap-2" asChild>
          <Link href={`/session/${sessionPostId}/summary?sessionAthleteId=${sessionAthleteId}`}>
            <Check className="size-4" />
            {dict.session.finishSession ?? "Finish session"}
          </Link>
        </Button>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>
    )
  }

  // ─── exercise runner ──────────────────────────────────────────────────────────

  const selfieState = active ? (selfieStates[active.sessionExerciseId] ?? "idle") : "idle"
  const selfieError = active ? selfieErrors[active.sessionExerciseId] : undefined
  const isCompleted = active ? completedSet.has(active.sessionExerciseId) : false

  return (
    <div className="flex flex-col gap-5 px-4 py-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <Badge className="w-fit border-0 text-primary-foreground" style={{ backgroundColor: teamColor }}>
          {teamName}
        </Badge>
        <h1 className="text-balance text-xl font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-3">
          <Progress value={progressPct} className="h-2 flex-1" />
          <span className="shrink-0 text-xs font-medium tabular text-muted-foreground">
            {completedCount}/{exercises.length}
          </span>
        </div>
      </header>

      {/* Navigation pills */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {exercises.map((ex, idx) => {
          const done = completedSet.has(ex.sessionExerciseId)
          const isActive = idx === activeIndex
          return (
            <button
              key={ex.sessionExerciseId}
              onClick={() => setActiveIndex(idx)}
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                done
                  ? "bg-emerald-500 text-white"
                  : isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              aria-label={`Exercise ${idx + 1}${done ? " (completed)" : ""}`}
            >
              {done ? <Check className="size-3" /> : idx + 1}
            </button>
          )
        })}
      </div>

      {/* General error */}
      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Active exercise card */}
      {active ? (
        <Card className="flex flex-col gap-4 overflow-hidden p-0">
          {/* Exercise image */}
          {active.imageUrl ? (
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              <Image
                src={active.imageUrl}
                alt={active.name}
                fill
                className="object-cover"
                crossOrigin="anonymous"
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-muted text-xs text-muted-foreground">
              No photo
            </div>
          )}

          <div className="flex flex-col gap-4 p-4">
            {/* Exercise info */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground tabular">
                  {activeIndex + 1} / {exercises.length}
                </span>
                {isCompleted && (
                  <Badge className="gap-1 bg-emerald-500/15 text-emerald-600">
                    <Check className="size-3" /> Done
                  </Badge>
                )}
              </div>
              <h2 className="text-lg font-semibold">{active.name}</h2>
              {active.description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{active.description}</p>
              ) : null}
              {active.sets || active.reps ? (
                <p className="text-sm font-medium tabular">
                  {active.sets ? `${active.sets} ${dict.session.sets}` : ""}
                  {active.sets && active.reps ? " · " : ""}
                  {active.reps ? `${active.reps} ${dict.session.reps}` : ""}
                </p>
              ) : null}
            </div>

            {/* Video */}
            {active.videoUrl ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowVideo((v) => !v)}
                >
                  {showVideo ? "Hide video" : dict.session.watchDemo}
                </Button>
                {showVideo ? (
                  <div className="aspect-video overflow-hidden rounded-xl bg-muted">
                    <iframe
                      className="size-full"
                      src={active.videoUrl.replace("watch?v=", "embed/")}
                      title={`${active.name} demo`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ── Selfie upload ── */}
            {!isCompleted ? (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4">
                <div className="flex items-center gap-2">
                  <Camera className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {selfieState === "done"
                      ? "Selfie uploaded ✓"
                      : "Upload a selfie to complete this exercise"}
                  </p>
                </div>
                {selfieState !== "done" ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Take a photo showing you completed the exercise. Coach Ahmed can review it from your athlete profile.
                    </p>
                    <label className="relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-5 transition-colors hover:bg-muted/50">
                      <Camera className="size-6 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {selfieState === "uploading" ? "Uploading…" : "Tap to choose or capture photo"}
                      </span>
                      <span className="text-xs text-muted-foreground">Max 8 MB · JPG, PNG, WebP</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="absolute inset-0 cursor-pointer opacity-0"
                        disabled={isPending || selfieState === "uploading"}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleSelfieUpload(active.sessionExerciseId, file)
                        }}
                      />
                    </label>
                  </>
                ) : (
                  <p className="text-xs text-emerald-600">
                    Selfie saved. You can now mark this exercise as complete.
                  </p>
                )}
                {selfieError ? (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="size-3 shrink-0" /> {selfieError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* ── Complete / pain buttons ── */}
            {!isCompleted ? (
              <Button
                size="lg"
                disabled={isPending || selfieState !== "done"}
                onClick={() => handleCompleteExercise(active.sessionExerciseId)}
                className="gap-2"
              >
                <Check className="size-4" />
                {activeIndex === exercises.length - 1 ? "Complete final exercise" : "Complete exercise"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700">
                <Check className="size-4 shrink-0" />
                Exercise completed
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => setPainDialogFor(active.sessionExerciseId)}
            >
              <TriangleAlert className="size-4" />
              {dict.session.reportPain}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Prev / Next nav */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={activeIndex === 0}
          onClick={() => { setActiveIndex((i) => Math.max(0, i - 1)); setShowVideo(false) }}
        >
          <ChevronLeft className="size-4" />
          {dict.common.previous}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={activeIndex === exercises.length - 1}
          onClick={() => { setActiveIndex((i) => Math.min(exercises.length - 1, i + 1)); setShowVideo(false) }}
        >
          {dict.common.next}
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Pain dialog */}
      <Dialog open={!!painDialogFor} onOpenChange={(open) => !open && setPainDialogFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.session.reportPain}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pain-location">{dict.session.painLocation}</Label>
              <Textarea
                id="pain-location"
                value={painLocation}
                onChange={(e) => setPainLocation(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dict.session.painSeverity}: {painSeverity}</Label>
              <Slider
                value={[painSeverity]}
                min={1}
                max={10}
                step={1}
                onValueChange={(v) => setPainSeverity(v[0])}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pain-notes">{dict.session.painNotes}</Label>
              <Textarea
                id="pain-notes"
                value={painNotes}
                onChange={(e) => setPainNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPainDialogFor(null)}>
              {dict.common.cancel}
            </Button>
            <Button onClick={handleReportPain} disabled={isPending}>
              {dict.common.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
