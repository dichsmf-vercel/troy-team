"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight, CheckCircle2, ListChecks, ArrowRight, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { completeProgramSession, uploadProgramExerciseSelfie } from "@/app/(athlete)/program/session/actions"
import type { StoredProgramExercise } from "@/lib/program-data"
import { useLanguage, useT } from "@/components/providers/language-provider"
import { ExerciseMedia } from "@/components/session/exercise-media"
import { exerciseDisplayName } from "@/lib/exercise-media"

type ProgramFeedbackRow = { exercise_index: number; difficulty: number | null; pain_notes: string | null; enjoyment: number | null }

export function ProgramSessionRunner({
  programId,
  date,
  time,
  exercises,
  initialFeedback,
  initialCompleted = false,
  showExerciseRecap = true,
  selfieRequired = false,
  initialSelfies = [],
}: {
  programId: string
  date: string
  time: string
  exercises: StoredProgramExercise[]
  initialFeedback: ProgramFeedbackRow[]
  initialCompleted?: boolean
  showExerciseRecap?: boolean
  selfieRequired?: boolean
  /** Exercise indexes whose selfie is already uploaded (so a reload does not ask again). */
  initialSelfies?: number[]
}) {
  const t = useT()
  const { language } = useLanguage()
  const [activeIndex, setActiveIndex] = useState(0)
  const [completed, setCompleted] = useState<number[]>(
    initialCompleted ? exercises.map((_, index) => index) : []
  )
  const [difficulty, setDifficulty] = useState(3)
  const [painNotes, setPainNotes] = useState("")
  const [enjoyment, setEnjoyment] = useState(3)
  const [finished, setFinished] = useState(initialCompleted)
  const [recapPage, setRecapPage] = useState(false)
  const [feedbackPage, setFeedbackPage] = useState(false)
  const [viewRecapAfterFinished, setViewRecapAfterFinished] = useState(false)
  const [selfieState, setSelfieState] = useState<Record<number, "uploaded" | "error">>(() => Object.fromEntries(initialSelfies.map((index) => [index, "uploaded" as const])))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const active = exercises[activeIndex]
  const allDone = exercises.length > 0 && completed.length === exercises.length

  // Keep progress on this device: no exercise can be skipped, so a reload must not start over.
  const progressKey = `troy-session:${programId}:${date}`
  useEffect(() => {
    if (initialCompleted) return
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(progressKey) ?? "[]")
      const done = Array.isArray(saved) ? [...new Set(saved)].filter((index): index is number => Number.isInteger(index) && index >= 0 && index < exercises.length) : []
      if (!done.length) return
      setCompleted(done)
      setActiveIndex(Math.max(0, exercises.findIndex((_, index) => !done.includes(index))))
    } catch {
      // Storage unavailable: progress simply starts empty.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey])

  function saveProgress(done: number[] | null) {
    try {
      if (done) localStorage.setItem(progressKey, JSON.stringify(done))
      else localStorage.removeItem(progressKey)
    } catch {
      // Progress is only a convenience.
    }
  }

  function backToExercises() {
    const missing = exercises.findIndex((_, index) => (selfieRequired && selfieState[index] !== "uploaded") || !completed.includes(index))
    if (missing >= 0) setActiveIndex(missing)
    setError(null)
    setFeedbackPage(false)
  }

  function finishSession() {
    startTransition(async () => {
      const result = await completeProgramSession({
        programId,
        date,
        difficulty,
        painNotes,
        enjoyment,
      })
      if (result.error) {
        setError(result.error)
      } else {
        saveProgress(null)
        setFinished(true)
        setFeedbackPage(false)
        setRecapPage(false)
      }
    })
  }

  function handleExerciseComplete() {
    const done = completed.includes(activeIndex) ? completed : [...completed, activeIndex]
    setCompleted(done)
    saveProgress(done)
    setError(null)

    const next = exercises.findIndex((_, index) => index > activeIndex && !done.includes(index))
    if (next >= 0) {
      setActiveIndex(next)
    } else if (done.length < exercises.length) {
      // No exercise may be skipped: go back to the first one that is not done.
      setActiveIndex(exercises.findIndex((_, index) => !done.includes(index)))
      setError(t.plural(exercises.length - done.length, "{count} exercise is not done yet. Complete every exercise to finish the session.", "{count} exercises are not done yet. Complete every exercise to finish the session."))
    } else {
      // Everything is done
      if (showExerciseRecap) {
        setRecapPage(true)
      } else {
        setFeedbackPage(true)
      }
    }
  }

  if (!exercises.length) {
    return (
      <Card className="p-6 text-center">
        <p className="font-medium">{t("No exercises scheduled for this session.")}</p>
        <Link className="mt-4 inline-flex text-sm text-primary underline" href="/program">
          {t("Back to program")}
        </Link>
      </Card>
    )
  }

  // Finished screen (with optional view recap modal/state)
  if (finished && !viewRecapAfterFinished) {
    return (
      <Card className="mx-auto max-w-lg grid gap-4 p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Check className="size-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t("Session Completed!")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("This session has been recorded and marked attended in your training calendar.")}
          </p>
        </div>

        {showExerciseRecap && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewRecapAfterFinished(true)}
            className="mx-auto gap-2 text-xs"
          >
            <Eye className="size-4" /> {t("View Today's Exercise Recap")}
          </Button>
        )}

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {t("Back to Dashboard")}
          </Link>
        </div>
      </Card>
    )
  }

  // Recap Screen ("This is all the exercises you did today")
  if (recapPage || viewRecapAfterFinished) {
    return (
      <Card className="mx-auto max-w-xl p-5 sm:p-6 grid gap-4">
        <div className="flex items-center gap-2.5 border-b pb-3">
          <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <ListChecks className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{t("Session Recap")}</h1>
            <p className="text-xs text-muted-foreground">{t("This is all the exercises you did today")}</p>
          </div>
        </div>

        <div className="grid gap-2">
          {exercises.map((ex, idx) => {
            const isDone = completed.includes(idx) || finished
            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground truncate">
                      {exerciseDisplayName(ex.name_en ?? ex.name, null, language) || t("Exercise")}
                    </span>
                    {ex.section && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {t(ex.section)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {Number(ex.sets) === 1 ? t("{sets} set × {reps} reps", { sets: 1, reps: ex.reps ?? "-" }) : t("{sets} sets × {reps} reps", { sets: ex.sets ?? "-", reps: ex.reps ?? "-" })}
                    {ex.loadPercentage ? t(" @ {loadPercentage}% load", { loadPercentage: ex.loadPercentage }) : ""}
                  </p>
                </div>
                <div className="shrink-0 pl-2">
                  {isDone ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                      <CheckCircle2 className="size-4" /> {t("Done")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">{t("Skipped")}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t pt-3 flex items-center justify-between gap-3">
          {viewRecapAfterFinished ? (
            <Button
              variant="outline"
              onClick={() => setViewRecapAfterFinished(false)}
              className="w-full text-xs"
            >
              {t("Close Recap")}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setRecapPage(false)
                setFeedbackPage(true)
              }}
              className="w-full gap-2 text-xs font-semibold"
            >
              {t("Proceed to Session Feedback")} <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // Feedback Form Screen
  if (feedbackPage) {
    return (
      <Card className="mx-auto grid max-w-xl gap-4 p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Final Step")}
          </p>
          <h1 className="mt-1 text-xl font-bold">{t("Session Feedback")}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {completed.length >= exercises.length
              ? t("All exercises completed. Submit quick feedback to log your recovery and wellness.")
              : t("{done} of {total} exercises completed. Submit quick feedback to log your recovery and wellness.", { done: completed.length, total: exercises.length })}
          </p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="program-difficulty" className="text-xs font-semibold">{t("How hard was the training session? (RPE 0–5)")}</Label>
            <span className="font-mono text-xs font-bold text-primary">{difficulty} / 5</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            id="program-difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="program-pain" className="text-xs font-semibold">{t("Any unnatural aches or pains?")}</Label>
          <Textarea
            id="program-pain"
            value={painNotes}
            onChange={(e) => setPainNotes(e.target.value)}
            placeholder={t("Describe any sharp discomfort, joint pain, or muscular stiffness...")}
            className="text-xs"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="program-enjoyment" className="text-xs font-semibold">{t("How did the session feel overall? (0–5)")}</Label>
            <span className="font-mono text-xs font-bold text-primary">{enjoyment} / 5</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            id="program-enjoyment"
            value={enjoyment}
            onChange={(e) => setEnjoyment(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <Button onClick={finishSession} disabled={pending} className="w-full font-semibold">
          {pending ? t("Saving feedback…") : t("Submit Feedback & Complete")}
        </Button>
        <Button variant="outline" onClick={backToExercises} disabled={pending} className="w-full gap-2">
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" /> {t("Back to exercises")}
        </Button>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </Card>
    )
  }

  // Exercise Runner Screen
  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {date} · {time}
          </p>
          <h1 className="text-xl font-bold">{t("Training Session")}</h1>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {activeIndex + 1} {t("of {exercisesCount}", { exercisesCount: exercises.length })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(completed.length / exercises.length) * 100}%` }}
        />
      </div>

      <Card className="grid gap-4 p-5">
        <div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary uppercase tracking-wide">
            {active.section ? t(active.section) : t("Training")}
          </span>
          <h2 className="mt-2 text-xl font-bold">{exerciseDisplayName(active.name_en ?? active.name, null, language) || t("Exercise")}</h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {Number(active.sets) === 1 ? t("{sets} set × {reps} reps", { sets: 1, reps: active.reps ?? "-" }) : t("{sets} sets × {reps} reps", { sets: active.sets ?? "-", reps: active.reps ?? "-" })}
            {active.loadPercentage ? t(" @ {loadPercentage}% load", { loadPercentage: active.loadPercentage }) : ""}
          </p>
        </div>

        <ExerciseMedia
          name={exerciseDisplayName(active.name_en ?? active.name, null, language) || t("Exercise")}
          images={active.media?.images ?? (active.image_url ? [active.image_url] : [])}
          videoUrl={active.media?.videoUrl ?? active.video_youtube_url ?? null}
        />

        {/* Selfie upload */}
        <div className="grid gap-2 rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold">{selfieRequired ? t("Proof of completion selfie (required)") : t("Proof of completion selfie (optional)")}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("Coach Ahmed can review this selfie directly on your athlete profile.")}
          </p>
          <input
            type="file"
            accept="image/*"
            capture="user"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              startTransition(async () => {
                const result = await uploadProgramExerciseSelfie({
                  programId,
                  date,
                  exerciseIndex: activeIndex,
                  file,
                })
                setSelfieState((current) => ({
                  ...current,
                  [activeIndex]: result.error ? "error" : "uploaded",
                }))
                if (result.error) setError(result.error)
              })
            }}
            disabled={pending}
            className="text-xs"
          />
          {selfieState[activeIndex] === "uploaded" && (
            <p className="text-xs font-semibold text-emerald-600">{t("Selfie saved for coach review.")}</p>
          )}
        </div>

        {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p> : null}
        {selfieRequired && selfieState[activeIndex] !== "uploaded" && !completed.includes(activeIndex) ? (
          <p className="text-xs text-muted-foreground">{t("Upload a selfie first to mark this exercise complete.")}</p>
        ) : null}
        <Button onClick={handleExerciseComplete} disabled={pending || (selfieRequired && selfieState[activeIndex] !== "uploaded" && !completed.includes(activeIndex))} className="w-full font-semibold">
          {activeIndex === exercises.length - 1
            ? t("Complete Session Exercises")
            : t("Complete Exercise & Continue")}
        </Button>
      </Card>

      {/* Prev / Next controls */}
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          size="sm"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          className="gap-1 text-xs"
        >
          <ChevronLeft className="size-4" /> {t("Previous")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={activeIndex === exercises.length - 1}
          onClick={() => setActiveIndex((index) => Math.min(exercises.length - 1, index + 1))}
          className="gap-1 text-xs"
        >
          {t("Next")} <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
