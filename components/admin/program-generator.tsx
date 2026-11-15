"use client"

import { useMemo, useState } from "react"
import { CalendarDays, Clock3, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { generateFourWeekProgram, monthLabel, weekdayLabel } from "@/lib/program-engine"
import { saveGeneratedProgram } from "@/app/admin/actions"

const weekdays = [0, 1, 2, 3, 4, 5, 6]

export function ProgramGenerator({
  athletes,
  exercises,
  rules,
}: {
  athletes: any[]
  exercises: any[]
  rules: any[]
}) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState("18:00")
  const [days, setDays] = useState<number[]>([1, 3, 5])
  const [generated, setGenerated] = useState<ReturnType<typeof generateFourWeekProgram>>([])
  const [saveState, setSaveState] = useState<string | null>(null)

  const selectedAthlete = athletes.find((athlete) => athlete.id === athleteId)
  const month = useMemo(() => monthLabel(startDate), [startDate])

  const ruleFilteredExercises = useMemo(() => {
    const values = Object.fromEntries(
      (selectedAthlete?.assessment_answers ?? []).map((answer: any) => [
        answer.question_key,
        answer.answer_json?.value,
      ])
    )
    const matches = (rule: any) => {
      const condition = rule.condition_json ?? {}
      const raw = values[condition.metric]
      const actual = Number(raw)
      const threshold = Number(condition.threshold)
      if (!Number.isFinite(actual) || !Number.isFinite(threshold)) return true
      if (condition.operator === ">") return actual > threshold
      if (condition.operator === ">=") return actual >= threshold
      if (condition.operator === "<") return actual < threshold
      if (condition.operator === "<=") return actual <= threshold
      if (condition.operator === "=") return actual === threshold
      return true
    }
    const activeRules = (rules ?? []).filter((rule) => rule.is_active && matches(rule))
    const removals = activeRules
      .filter((rule) => String(rule.action_json?.action).toUpperCase() === "REMOVE")
      .map((rule) => String(rule.action_json?.exercise_id ?? ""))
    const additions = activeRules
      .filter((rule) => String(rule.action_json?.action).toUpperCase() === "ADD")
      .map((rule) => String(rule.action_json?.exercise_id ?? ""))
    const allowed = exercises.filter(
      (exercise) => !removals.includes(exercise.id) && !removals.includes(exercise.exercise_code)
    )
    const added = exercises.filter(
      (exercise) =>
        additions.includes(exercise.id) || additions.includes(exercise.exercise_code)
    )
    return [...new Map([...added, ...allowed].map((exercise) => [exercise.id, exercise])).values()]
  }, [exercises, rules, selectedAthlete])

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            Rules & Legacy Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="program-athlete">Athlete</Label>
            <select
              id="program-athlete"
              value={athleteId}
              onChange={(event) => {
                setGenerated([])
                setSaveState(null)
                setAthleteId(event.target.value)
              }}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.profiles?.full_name ?? athlete.full_name ?? athlete.id}
                  {athlete.sport ? ` (${athlete.sport})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="program-start">Month start</Label>
            <Input
              id="program-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="program-time">Training time</Label>
            <div className="relative">
              <Clock3 className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="program-time"
                className="pl-9"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Exact training days</legend>
            <div className="grid grid-cols-4 gap-2">
              {weekdays.map((day) => (
                <label
                  key={day}
                  className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-medium ${
                    days.includes(day)
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="checkbox"
                    checked={days.includes(day)}
                    onChange={() =>
                      setDays((current) =>
                        current.includes(day)
                          ? current.filter((item) => item !== day)
                          : [...current, day].sort()
                      )
                    }
                  />
                  {weekdayLabel(day)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <Button
              type="button"
              disabled={!athleteId || !days.length}
              onClick={() => {
                console.log("[Rules-Program-Generator] Preview requested", {
                  athleteId,
                  startDate,
                  time,
                  weekdays: days,
                  birthYear: selectedAthlete?.birth_year,
                  sport: selectedAthlete?.sport,
                })
                const nextGenerated = generateFourWeekProgram({
                  startDate,
                  time,
                  weekdays: days,
                  exercises: ruleFilteredExercises,
                  birthYear: selectedAthlete?.birth_year,
                  sport: selectedAthlete?.sport,
                })
                console.log("[Rules-Program-Generator] Engine output sessions:", nextGenerated.length)
                setSaveState(null)
                setGenerated(nextGenerated)
              }}
            >
              Preview program
            </Button>
            {generated.length ? (
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  console.log("[Rules-Program-Generator] Save requested", { athleteId, startDate })
                  setSaveState("Saving...")
                  try {
                    const result = await saveGeneratedProgram({
                      athleteId,
                      startDate,
                      time,
                      weekdays: days,
                      sessions: generated,
                    })
                    console.log("[Rules-Program-Generator] Save response:", result)
                    setSaveState(result.error ?? "Saved for admin review")
                  } catch (err: any) {
                    console.error("[Rules-Program-Generator] Save error:", err)
                    if (
                      err?.message?.includes("Server Action") ||
                      String(err).includes("UnrecognizedActionError")
                    ) {
                      setSaveState("App was recently updated. Please refresh the page (Ctrl+F5).")
                    } else {
                      setSaveState(err?.message ?? "Failed to save program.")
                    }
                  }
                }}
              >
                {saveState === "Saving..." ? "Saving..." : "Save draft for review"}
              </Button>
            ) : null}
            {saveState && saveState !== "Saving..." ? (
              <p role="status" className="text-xs text-muted-foreground">
                {saveState}
              </p>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Structured: Warmup → Mobility → Rubber bands → FMS problems (weeks 1–2 only) → Strength/Power → Cooldown.
            Split: Upper, Lower, Full if 3 days/week.
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {selectedAthlete?.profiles?.full_name ?? "Select an athlete"}
              {selectedAthlete?.sport ? ` · ${String(selectedAthlete.sport).toUpperCase()}` : ""}
            </p>
            <h2 className="text-2xl font-semibold">{month}</h2>
          </div>
          <CalendarDays className="size-7 text-accent" />
        </div>
        {generated.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-64 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Preview the month to see scheduled sessions, structured warmups, mobility, FMS corrections, and progression.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {generated.map((session) => (
              <Card key={session.date} className="overflow-hidden">
                <CardContent className="grid gap-3 p-4 sm:grid-cols-[140px_1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Week {session.week} {session.focus ? `· ${session.focus}` : ""}
                    </p>
                    <p className="font-semibold text-sm">
                      {new Date(`${session.date}T12:00:00`).toLocaleDateString("en", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">{session.time}</p>
                    {session.seasonPeriod && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{session.seasonPeriod}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {session.exercises.map((exercise, exIdx) => (
                      <span
                        key={`${session.date}-${exercise.id}-${exIdx}`}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs"
                      >
                        <strong className="text-foreground">{exercise.section}:</strong> {exercise.name_en}
                        <span className="text-muted-foreground ml-1">({exercise.sets}×{exercise.reps}{exercise.loadPercentage ? ` @ ${exercise.loadPercentage}%` : ""})</span>
                      </span>
                    ))}
                  </div>
                  {session.tooFewExercises ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                      Too few exercises
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Draft</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
