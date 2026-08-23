"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { Play, Check, TriangleAlert, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import { startSession, toggleExerciseCompletion, reportPain } from "@/app/(athlete)/session/[sessionPostId]/actions"

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

  const completedCount = Object.values(completedMap).filter(Boolean).length
  const progressPct = exercises.length > 0 ? Math.round((completedCount / exercises.length) * 100) : 0
  const allDone = exercises.length > 0 && completedCount === exercises.length

  function handleStart() {
    startTransition(async () => {
      const result = await startSession(sessionPostId)
      if (result?.sessionAthleteId) setSessionAthleteId(result.sessionAthleteId)
      if (!attendedAt) setAttendedAt(new Date().toISOString())
    })
  }

  function handleToggle(sessionExerciseId: string, next: boolean) {
    if (!sessionAthleteId) return
    setCompletedMap((prev) => ({ ...prev, [sessionExerciseId]: next }))
    startTransition(async () => {
      await toggleExerciseCompletion(sessionAthleteId, sessionExerciseId, next)
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
          {new Date(sessionDate).toLocaleDateString(language === "ar" ? "ar" : "en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}{" "}
          &middot; {period === "morning" ? dict.session.morning : dict.session.evening}
        </p>
        <Button size="lg" className="mt-2 gap-2" onClick={handleStart} disabled={isPending}>
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
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={activeIndex === exercises.length - 1}
                onClick={() => setActiveIndex((i) => Math.min(exercises.length - 1, i + 1))}
                aria-label={dict.common.next}
              >
                <ChevronRight className="size-4" />
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
            <a
              href={active.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-accent-foreground underline underline-offset-4"
            >
              {dict.session.watchDemo}
            </a>
          ) : null}

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Checkbox
              id={`complete-${active.sessionExerciseId}`}
              checked={!!completedMap[active.sessionExerciseId]}
              onCheckedChange={(v) => handleToggle(active.sessionExerciseId, v === true)}
            />
            <Label htmlFor={`complete-${active.sessionExerciseId}`} className="text-sm font-medium">
              {dict.session.markComplete}
            </Label>
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
