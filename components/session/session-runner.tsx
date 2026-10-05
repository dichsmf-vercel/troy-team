"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { Play, Check, TriangleAlert, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Language } from "@/lib/i18n/dictionaries"
import { useLanguage } from "@/components/providers/language-provider"
import { startSession, toggleExerciseCompletion, reportPain, uploadSelfie, saveExerciseFeedback } from "@/app/(athlete)/session/[sessionPostId]/actions"
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
  const [sessionAthleteId, setSessionAthleteId] = useState(initialSessionAthleteId)
  const [attendedAt, setAttendedAt] = useState(initialAttendedAt)
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>(
    Object.fromEntries(initialCompletions.map((c) => [c.session_exercise_id, c.completed])),
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [painDialogFor, setPainDialogFor] = useState<string | null>(null)
  const [painLocation, setPainLocation] = useState("")
  const [painSeverity, setPainSeverity] = useState(3)
  const [painNotes, setPainNotes] = useState("")
  const [isPending, startTransition] = useTransition()
  const [showVideo, setShowVideo] = useState(false)
  const [selfieUploaded, setSelfieUploaded] = useState(initialSelfieUploaded)
  const [selfieError, setSelfieError] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState(3)
  const [enjoyment, setEnjoyment] = useState(3)
  const [feedbackNotes, setFeedbackNotes] = useState("")
  const [justification, setJustification] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) return
    streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
    videoRef.current.srcObject = streamRef.current
  }

  function captureSelfie() {
    const video = videoRef.current
    if (!video || !sessionAthleteId || video.videoWidth === 0) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    startTransition(async () => {
      const result = await uploadSelfie(sessionAthleteId, canvas.toDataURL("image/jpeg", 0.82))
      if (result?.error) setSelfieError(result.error)
      else { setSelfieUploaded(true); setSelfieError(null); streamRef.current?.getTracks().forEach((track) => track.stop()) }
    })
  }

  function submitJustification() {
    if (!sessionAthleteId || !justification.trim()) return
    startTransition(async () => { const result = await uploadSelfie(sessionAthleteId, "", justification); if (result?.error) setSelfieError(result.error); else { setSelfieUploaded(true); setSelfieError(null) } })
  }

  const completedCount = Object.values(completedMap).filter(Boolean).length
  const progressPct = exercises.length > 0 ? Math.round((completedCount / exercises.length) * 100) : 0
  const allDone = exercises.length > 0 && completedCount === exercises.length

  useEffect(() => {
    console.log("[assigned-session-debug] Runner mounted", {
      sessionPostId,
      initialSessionAthleteId: initialSessionAthleteId || null,
      initialAttendedAt: initialAttendedAt || null,
      exerciseCount: exercises.length,
      exerciseIds: exercises.map((exercise) => exercise.exerciseId),
      sessionExerciseIds: exercises.map((exercise) => exercise.sessionExerciseId),
      completionCount: Object.values(completedMap).filter(Boolean).length,
      checks: {
        runnerReceivedExercises: exercises.length > 0,
        runnerReceivedLinkedExerciseIds: exercises.every((exercise) => Boolean(exercise.exerciseId)),
        attendanceRequiredBeforeStart: !initialSessionAthleteId,
      },
    })
  }, [sessionPostId, initialSessionAthleteId, initialAttendedAt, exercises, completedMap])

  function handleStart() {
    const startPayload = {
      sessionPostId,
      initialSessionAthleteId: initialSessionAthleteId || null,
      exerciseCount: exercises.length,
      exerciseIds: exercises.map((exercise) => exercise.exerciseId),
      exerciseRowIds: exercises.map((exercise) => exercise.sessionExerciseId),
      checks: {
        sessionPostIdPresent: Boolean(sessionPostId),
        exercisesResolved: exercises.length > 0,
        exerciseIdsResolved: exercises.every((exercise) => Boolean(exercise.exerciseId)),
        alreadyAttended: Boolean(attendedAt),
      },
    }
    console.groupCollapsed("[assigned-session-debug] Runner start clicked")
    console.log(startPayload)
    console.table(startPayload.checks)
    if (!startPayload.checks.exercisesResolved) console.error("[assigned-session-debug] Runner opened with zero exercises")
    if (!startPayload.checks.exerciseIdsResolved) console.error("[assigned-session-debug] One or more session exercises has no linked exercise")
    console.groupEnd()
    startTransition(async () => {
      const requestStartedAt = performance.now()
      const result = await startSession(sessionPostId)
      console.log("[assigned-session-debug] startSession response", { sessionPostId, result, exerciseCount: exercises.length, durationMs: Math.round(performance.now() - requestStartedAt), authenticatedSessionCreated: Boolean(result?.sessionAthleteId), errorReturned: Boolean(result?.error) })
      if (result?.error) setSelfieError(result.error)
      if (result?.sessionAthleteId) setSessionAthleteId(result.sessionAthleteId)
      if (!attendedAt && !result?.error) setAttendedAt(new Date().toISOString())
      console.log("[assigned-session-debug] Runner state after start response", {
        sessionPostId,
        previousSessionAthleteId: initialSessionAthleteId || null,
        returnedSessionAthleteId: result?.sessionAthleteId ?? null,
        error: result?.error ?? null,
        nextStep: result?.error ? "blocked" : "attendance-ready",
      })
    })
  }

  function handleToggle(sessionExerciseId: string, next: boolean) {
    if (!sessionAthleteId) return
    setCompletedMap((prev) => ({ ...prev, [sessionExerciseId]: next }))
    startTransition(async () => {
      const result = await toggleExerciseCompletion(sessionAthleteId, sessionExerciseId, next)
      if (result?.error) setSelfieError(result.error)
    })
  }

  function handleFeedback() {
    if (!sessionAthleteId || !active) return
    startTransition(async () => { const result = await saveExerciseFeedback(sessionAthleteId, active.sessionExerciseId, { difficulty, enjoyment, painNotes: feedbackNotes }); if (result?.error) setSelfieError(result.error); else setFeedbackNotes("") })
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
      setPainSeverity(3)
      setPainNotes("")
    })
  }

  const active = exercises[activeIndex]

  if (!attendedAt) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <Badge
          className="border-0 text-primary-foreground"
          style={{ backgroundColor: teamColor }}
        >
          {teamName}
        </Badge>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
        {notes ? <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{notes}</p> : null}
        <p className="text-sm text-muted-foreground tabular">
          {safeDate(sessionDate, language === "ar" ? "ar" : "en-US", { weekday: "long", month: "long", day: "numeric" })}{" "}
          &middot; {safeTime(period, language === "ar" ? "ar" : "en-US")}
        </p>
        <Button size="lg" className="mt-3 h-14 w-full gap-3 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90" onClick={handleStart} disabled={isPending}>
          <Play className="size-4" />
          {dict.session.startSession}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Badge className="w-fit border-0 text-primary-foreground" style={{ backgroundColor: teamColor }}>
          {teamName}
        </Badge>
        <h1 className="text-balance text-xl font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-3">
          <Progress value={progressPct} className="h-2 flex-1" />
          <span className="text-xs font-medium tabular text-muted-foreground">
            {completedCount}/{exercises.length}
          </span>
        </div>
      </header>

      {active ? (
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tabular text-muted-foreground">
              {activeIndex + 1} / {exercises.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                aria-label={dict.common.previous}
              >
                <ChevronLeft className="size-4" />
              </Button>

            </div>
          </div>

          {active.imageUrl ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
              <Image
                src={active.imageUrl || "/placeholder.svg"}
                alt={active.name}
                fill
                className="object-cover"
                crossOrigin="anonymous"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-balance">{active.name}</h2>
            {active.description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{active.description}</p>
            ) : null}
            {active.sets || active.reps ? (
              <p className="text-sm font-medium tabular text-foreground">
                {active.sets ? `${active.sets} ${dict.session.sets}` : ""}
                {active.sets && active.reps ? " · " : ""}
                {active.reps ? `${active.reps} ${dict.session.reps}` : ""}
              </p>
            ) : null}
          </div>

          {active.videoUrl ? (
            <div className="grid gap-2">
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowVideo((value) => !value)}>{showVideo ? "Hide video" : dict.session.watchDemo}</Button>
              {showVideo ? <div className="aspect-video overflow-hidden rounded-md bg-muted"><iframe className="size-full" src={active.videoUrl.replace("watch?v=", "embed/")} title={`${active.name} video`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : null}
            </div>
          ) : null}

          <div className="grid gap-3 border-t border-border pt-4"><Label>Exercise feedback (optional)</Label><Label>How hard was this exercise? (0–5)</Label><input type="range" min="0" max="5" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} /><span className="text-xs text-muted-foreground">{difficulty}/5</span><Label>Any unnatural pains?</Label><Textarea value={feedbackNotes} onChange={(event) => setFeedbackNotes(event.target.value)} placeholder="Describe pain or discomfort" /><Label>How did it feel overall? (0–5)</Label><input type="range" min="0" max="5" value={enjoyment} onChange={(event) => setEnjoyment(Number(event.target.value))} /><Button type="button" variant="outline" onClick={handleFeedback} disabled={!sessionAthleteId || isPending}>Save exercise feedback</Button></div>

          <div className="grid gap-2 border-t border-border pt-4">
            <Button type="button" size="lg" disabled={!sessionAthleteId || isPending} onClick={() => { handleToggle(active.sessionExerciseId, true); setActiveIndex((index) => Math.min(exercises.length - 1, index + 1)) }}>
              {activeIndex === exercises.length - 1 ? dict.session.finishSession : dict.common.next}
              <ChevronRight className="size-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">Complete this exercise to continue to the next one.</p>
          </div>

          <Button
            variant="outline"
            className="gap-2 text-destructive"
            onClick={() => setPainDialogFor(active.sessionExerciseId)}
          >
            <TriangleAlert className="size-4" />
            {dict.session.reportPain}
          </Button>
        </Card>
      ) : null}

      {allDone ? (
        <Button size="lg" className="gap-2" asChild>
          <Link href={`/session/${sessionPostId}/summary?sessionAthleteId=${sessionAthleteId}`}>
            <Check className="size-4" />
            {dict.session.finishSession}
          </Link>
        </Button>
      ) : null}

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
              <Label>
                {dict.session.painSeverity}: {painSeverity}
              </Label>
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
