"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight, CheckCircle2, ListChecks, ArrowRight, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { completeProgramSession, uploadProgramExerciseSelfie } from "@/app/(athlete)/program/session/actions"

export function ProgramSessionRunner({
  programId,
  date,
  time,
  exercises,
  initialFeedback,
  initialCompleted = false,
  showExerciseRecap = true,
}: {
  programId: string
  date: string
  time: string
  exercises: any[]
  initialFeedback: any[]
  initialCompleted?: boolean
  showExerciseRecap?: boolean
}) {
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
  const [selfieState, setSelfieState] = useState<Record<number, "uploaded" | "error">>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const active = exercises[activeIndex]
  const allDone = exercises.length > 0 && completed.length === exercises.length

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
        setFinished(true)
        setFeedbackPage(false)
        setRecapPage(false)
      }
    })
  }

  function handleExerciseComplete() {
    setCompleted((current) =>
      current.includes(activeIndex) ? current : [...current, activeIndex]
    )

    if (activeIndex < exercises.length - 1) {
      setActiveIndex((index) => index + 1)
    } else {
      // Reached the end
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
        <p className="font-medium">No exercises scheduled for this session.</p>
        <Link className="mt-4 inline-flex text-sm text-primary underline" href="/program">
          Back to program
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
          <h1 className="text-xl font-bold">Session Completed!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This session has been recorded and marked attended in your training calendar.
          </p>
        </div>

        {showExerciseRecap && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewRecapAfterFinished(true)}
            className="mx-auto gap-2 text-xs"
          >
            <Eye className="size-4" /> View Today's Exercise Recap
          </Button>
        )}

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Back to Dashboard
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
            <h1 className="text-lg font-bold">Session Recap</h1>
            <p className="text-xs text-muted-foreground">This is all the exercises you did today</p>
          </div>
        </div>

        <div className="grid gap-2">
          {exercises.map((ex: any, idx: number) => {
            const isDone = completed.includes(idx) || finished
            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground truncate">
                      {ex.name_en ?? ex.name ?? "Exercise"}
                    </span>
                    {ex.section && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {ex.section}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {ex.sets ?? "-"} sets × {ex.reps ?? "-"} reps
                    {ex.loadPercentage ? ` @ ${ex.loadPercentage}% load` : ""}
                  </p>
                </div>
                <div className="shrink-0 pl-2">
                  {isDone ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                      <CheckCircle2 className="size-4" /> Done
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Skipped</span>
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
              Close Recap
            </Button>
          ) : (
            <Button
              onClick={() => {
                setRecapPage(false)
                setFeedbackPage(true)
              }}
              className="w-full gap-2 text-xs font-semibold"
            >
              Proceed to Session Feedback <ArrowRight className="size-4" />
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
            Final Step
          </p>
          <h1 className="mt-1 text-xl font-bold">Session Feedback</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            All exercises completed. Submit quick feedback to log your recovery and wellness.
          </p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">How hard was the training session? (RPE 0–5)</Label>
            <span className="font-mono text-xs font-bold text-primary">{difficulty} / 5</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold">Any unnatural aches or pains?</Label>
          <Textarea
            value={painNotes}
            onChange={(e) => setPainNotes(e.target.value)}
            placeholder="Describe any sharp discomfort, joint pain, or muscular stiffness..."
            className="text-xs"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">How did the session feel overall? (0–5)</Label>
            <span className="font-mono text-xs font-bold text-primary">{enjoyment} / 5</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            value={enjoyment}
            onChange={(e) => setEnjoyment(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <Button onClick={finishSession} disabled={pending} className="w-full font-semibold">
          {pending ? "Saving feedback…" : "Submit Feedback & Complete"}
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
          <h1 className="text-xl font-bold">Training Session</h1>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {activeIndex + 1} of {exercises.length}
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
            {active.section ?? "Training"}
          </span>
          <h2 className="mt-2 text-xl font-bold">{active.name_en ?? active.name ?? "Exercise"}</h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {active.sets ?? "-"} sets × {active.reps ?? "-"} reps
            {active.loadPercentage ? ` @ ${active.loadPercentage}% load` : ""}
          </p>
        </div>

        {active.image_url && (
          <img
            src={active.image_url}
            alt={active.name_en ?? "Exercise"}
            className="aspect-video w-full rounded-lg object-cover"
          />
        )}

        {/* Selfie upload */}
        <div className="grid gap-2 rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold">Proof of completion selfie (optional)</p>
          <p className="text-[11px] text-muted-foreground">
            Coach Ahmed can review this selfie directly on your athlete profile.
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
            <p className="text-xs font-semibold text-emerald-600">Selfie saved for coach review.</p>
          )}
        </div>

        {active.video_youtube_url && (
          <a
            href={active.video_youtube_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline"
          >
            Watch exercise demonstration video
          </a>
        )}

        <Button onClick={handleExerciseComplete} disabled={pending} className="w-full font-semibold">
          {activeIndex === exercises.length - 1
            ? "Complete Session Exercises"
            : "Complete Exercise & Continue"}
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
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={activeIndex === exercises.length - 1}
          onClick={() => setActiveIndex((index) => Math.min(exercises.length - 1, index + 1))}
          className="gap-1 text-xs"
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
