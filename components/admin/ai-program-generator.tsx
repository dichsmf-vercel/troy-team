"use client"

import { useState } from "react"
import {
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Edit3,
  Loader2,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { generateProgramWithAI, saveAIGeneratedProgram, saveAdminEditsAndLearn } from "@/app/admin/actions"
import type { GeminiProgramOutput, GeminiSession, GeminiExercise } from "@/lib/gemini"
import { weekdayLabel, monthLabel } from "@/lib/program-engine"

const weekdays = [0, 1, 2, 3, 4, 5, 6]

// ─── Types ────────────────────────────────────────────────────────────────────

type EditState = {
  [sessionIdx: number]: {
    [exIdx: number]: Partial<GeminiExercise>
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AIProgramGenerator({ athletes }: { athletes: any[] }) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState("18:00")
  const [days, setDays] = useState<number[]>([1, 3, 5])

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [program, setProgram] = useState<GeminiProgramOutput | null>(null)
  const [originalProgram, setOriginalProgram] = useState<GeminiProgramOutput | null>(null)

  // Editing
  const [edits, setEdits] = useState<EditState>({})
  const [editMode, setEditMode] = useState(false)
  const [adminReason, setAdminReason] = useState("")
  const [expandedSession, setExpandedSession] = useState<number | null>(0)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const selectedAthlete = athletes.find((a) => a.id === athleteId)
  const month = monthLabel(startDate)

  // Merge edits into program
  const displayProgram: GeminiProgramOutput | null = program
    ? {
        ...program,
        sessions: program.sessions.map((session, sIdx) => ({
          ...session,
          exercises: session.exercises.map((ex, eIdx) => ({
            ...ex,
            ...(edits[sIdx]?.[eIdx] ?? {}),
          })),
        })),
      }
    : null

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    setProgram(null)
    setOriginalProgram(null)
    setEdits({})
    setEditMode(false)
    setSaveMsg(null)
    setExpandedSession(0)

    const result = await generateProgramWithAI({ athleteId, startDate, time, weekdays: days })
    setGenerating(false)

    if (result.error || !result.data) {
      setGenError(result.error ?? "Generation failed.")
      return
    }

    setProgram(result.data)
    setOriginalProgram(result.data)
  }

  async function handleSave() {
    if (!displayProgram) return
    setSaving(true)
    setSaveMsg(null)

    // If edits were made, run the learning flow
    if (editMode && originalProgram && adminReason.trim()) {
      const learnResult = await saveAdminEditsAndLearn({
        programId: "", // will be filled after save
        editedProgram: displayProgram,
        originalProgram,
        adminReason,
        athleteName: selectedAthlete?.profiles?.full_name ?? "Athlete",
      })
      if (learnResult.error) {
        setSaveMsg(`Warning: edits saved but learning failed: ${learnResult.error}`)
      }
    }

    const result = await saveAIGeneratedProgram({
      athleteId,
      startDate,
      time,
      weekdays: days,
      program: displayProgram,
    })
    setSaving(false)
    setSaveMsg(result.error ?? "Program saved for admin review.")
  }

  function updateExercise(sIdx: number, eIdx: number, field: keyof GeminiExercise, value: unknown) {
    setEdits((prev) => ({
      ...prev,
      [sIdx]: {
        ...prev[sIdx],
        [eIdx]: { ...prev[sIdx]?.[eIdx], [field]: value },
      },
    }))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      {/* ── Left panel ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-4 text-violet-500" />
            AI program generation
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Gemini designs a personalized 4-week plan from the athlete's profile, assessment scores, and sport season.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-athlete">Athlete</Label>
            <select
              id="ai-athlete"
              value={athleteId}
              onChange={(e) => { setAthleteId(e.target.value); setProgram(null); setGenError(null) }}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.profiles?.full_name ?? a.id}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-start">Month start</Label>
            <Input id="ai-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-time">Session time</Label>
            <div className="relative">
              <Clock3 className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input id="ai-time" className="pl-9" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Training days</legend>
            <div className="grid grid-cols-4 gap-2">
              {weekdays.map((day) => (
                <label
                  key={day}
                  className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs ${
                    days.includes(day) ? "border-violet-500 bg-violet-500/10 text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="checkbox"
                    checked={days.includes(day)}
                    onChange={() =>
                      setDays((cur) =>
                        cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]
                      )
                    }
                  />
                  {weekdayLabel(day)}
                </label>
              ))}
            </div>
          </fieldset>

          {selectedAthlete && !selectedAthlete.latest_assessment && (
            <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
              No assessment data for this athlete. Gemini will design a conservative baseline program.
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!athleteId || !days.length || generating}
            className="gap-2 bg-violet-600 hover:bg-violet-700"
          >
            {generating ? (
              <><Loader2 className="size-4 animate-spin" />Generating…</>
            ) : (
              <><Sparkles className="size-4" />Generate with AI</>
            )}
          </Button>

          {genError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{genError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Right panel ── */}
      <div className="grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{selectedAthlete?.profiles?.full_name ?? "Select an athlete"}</p>
            <h2 className="text-2xl font-semibold">{month}</h2>
          </div>
          <CalendarDays className="size-7 text-violet-500" />
        </div>

        {!displayProgram && !generating && (
          <Card>
            <CardContent className="flex min-h-64 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Click "Generate with AI" to create a personalized program.
            </CardContent>
          </Card>
        )}

        {generating && (
          <Card>
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="size-8 animate-spin text-violet-500" />
              <p className="text-sm font-medium">Gemini is designing the program…</p>
              <p className="text-xs text-muted-foreground">This usually takes 10–20 seconds.</p>
            </CardContent>
          </Card>
        )}

        {displayProgram && !generating && (
          <>
            {/* Program meta */}
            <Card className="border-violet-200 bg-violet-500/5">
              <CardContent className="p-4 grid gap-3">
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-violet-500 shrink-0" />
                  <p className="text-sm font-semibold">{displayProgram.goal}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{displayProgram.rationale}</p>
                {displayProgram.warnings.length > 0 && (
                  <div className="grid gap-1">
                    {displayProgram.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit toggle */}
            <div className="flex items-center gap-3">
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setEditMode((v) => !v)}
              >
                <Edit3 className="size-4" />
                {editMode ? "Editing mode on" : "Edit program"}
              </Button>
              {editMode && (
                <p className="text-xs text-muted-foreground">Click any field in a session to edit it.</p>
              )}
            </div>

            {/* Sessions */}
            <div className="grid gap-3">
              {displayProgram.sessions.map((session, sIdx) => (
                <SessionCard
                  key={`${session.date}-${sIdx}`}
                  session={session}
                  sIdx={sIdx}
                  editMode={editMode}
                  expanded={expandedSession === sIdx}
                  onToggle={() => setExpandedSession(expandedSession === sIdx ? null : sIdx)}
                  onEditExercise={(eIdx, field, value) => updateExercise(sIdx, eIdx, field, value)}
                />
              ))}
            </div>

            {/* Admin edit reason (shown in edit mode) */}
            {editMode && (
              <div className="grid gap-2">
                <Label htmlFor="admin-reason">Why did you make these changes? (helps Gemini learn)</Label>
                <Textarea
                  id="admin-reason"
                  value={adminReason}
                  onChange={(e) => setAdminReason(e.target.value)}
                  placeholder="e.g. Replaced squats with leg press because athlete has knee issues..."
                  rows={3}
                />
              </div>
            )}

            {/* Save */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <><Loader2 className="size-4 animate-spin" />Saving…</>
              ) : (
                <><Check className="size-4" />Save for admin review</>
              )}
            </Button>
            {saveMsg && <p role="status" className="text-xs text-muted-foreground">{saveMsg}</p>}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  sIdx,
  editMode,
  expanded,
  onToggle,
  onEditExercise,
}: {
  session: GeminiSession
  sIdx: number
  editMode: boolean
  expanded: boolean
  onToggle: () => void
  onEditExercise: (eIdx: number, field: keyof GeminiExercise, value: unknown) => void
}) {
  const dateLabel = new Date(`${session.date}T12:00:00`).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="shrink-0 text-xs">
            Week {session.week}
          </Badge>
          <div>
            <p className="text-sm font-semibold">{dateLabel}</p>
            <p className="text-xs text-muted-foreground">{session.time} · {session.exercises.length} exercises</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 grid gap-3">
          {session.exercises.map((ex, eIdx) => (
            <ExerciseRow
              key={`${ex.name_en}-${eIdx}`}
              exercise={ex}
              eIdx={eIdx}
              editMode={editMode}
              onEdit={(field, value) => onEditExercise(eIdx, field, value)}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Exercise row ─────────────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  eIdx,
  editMode,
  onEdit,
}: {
  exercise: GeminiExercise
  eIdx: number
  editMode: boolean
  onEdit: (field: keyof GeminiExercise, value: unknown) => void
}) {
  if (!editMode) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{exercise.section} · </span>
          <span className="font-medium">{exercise.name_en}</span>
          {exercise.notes && <p className="mt-0.5 text-xs text-muted-foreground">{exercise.notes}</p>}
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p>{exercise.sets}×{exercise.reps}</p>
          {exercise.load_percentage && <p>{exercise.load_percentage}%</p>}
          {exercise.tempo && <p>{exercise.tempo}</p>}
        </div>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{exercise.section}</p>
      <Input
        value={exercise.name_en}
        onChange={(e) => onEdit("name_en", e.target.value)}
        className="h-8 text-sm font-medium"
        placeholder="Exercise name"
      />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Sets</Label>
          <Input
            type="number"
            min="1"
            value={exercise.sets}
            onChange={(e) => onEdit("sets", Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Reps</Label>
          <Input
            value={exercise.reps}
            onChange={(e) => onEdit("reps", e.target.value)}
            className="h-8 text-sm"
            placeholder="8-12"
          />
        </div>
        <div>
          <Label className="text-xs">Load %</Label>
          <Input
            type="number"
            min="0"
            max="110"
            value={exercise.load_percentage ?? ""}
            onChange={(e) => onEdit("load_percentage", e.target.value ? Number(e.target.value) : null)}
            className="h-8 text-sm"
            placeholder="—"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Coaching notes</Label>
        <Input
          value={exercise.notes ?? ""}
          onChange={(e) => onEdit("notes", e.target.value || null)}
          className="h-8 text-sm"
          placeholder="Optional coaching cue..."
        />
      </div>
    </div>
  )
}
