"use client"

import { useState } from "react"
import {
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  ArrowDown,
  ArrowUp,
  Edit3,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { generateProgramWithAI, saveAIGeneratedProgram, saveAdminEditsAndLearn, generateLegacyFallbackProgram } from "@/app/admin/actions/ai"
import type { GeminiProgramOutput, GeminiSession, GeminiExercise } from "@/lib/gemini-types"
import { weekdayLabel, monthLabel } from "@/lib/program-engine"
import { useLanguage } from "@/components/providers/language-provider"
import { AthletePicker, defaultTrainingDays, type PickableAthlete } from "@/components/admin/athlete-picker"
import { todayInAppZone } from "@/lib/dates"
import { actionErrorMessage } from "@/lib/client-errors"
import { ExerciseMediaPreview } from "@/components/admin/exercise-media-preview"
import type { AdminExercise } from "@/lib/admin/types"
import { PROGRAM_SECTIONS } from "@/lib/gemini-validate"
import { sessionVolumeWarnings } from "@/lib/program-edits"

const weekdays = [0, 1, 2, 3, 4, 5, 6]

// ─── Types ────────────────────────────────────────────────────────────────────

/** Edits the coach can make to one session's exercise list (any position). */
type SessionEditor = {
  update: (eIdx: number, field: keyof GeminiExercise, value: unknown) => void
  replace: (eIdx: number, exerciseId: string) => void
  move: (eIdx: number, direction: -1 | 1) => void
  remove: (eIdx: number) => void
  add: (exerciseId: string, section: string) => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export type AthleteOption = PickableAthlete & {
  latest_assessment?: unknown
}


export function AIProgramGenerator({ athletes, exercises = [] }: { athletes: AthleteOption[]; exercises?: AdminExercise[] }) {
  const { t, locale } = useLanguage()
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "")
  const [startDate, setStartDate] = useState(todayInAppZone())
  const [time, setTime] = useState("18:00")
  const [days, setDays] = useState<number[]>(() => defaultTrainingDays(athletes[0]))

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [program, setProgram] = useState<GeminiProgramOutput | null>(null)
  const [originalProgram, setOriginalProgram] = useState<GeminiProgramOutput | null>(null)

  // Editing
  const [editMode, setEditMode] = useState(false)
  const [adminReason, setAdminReason] = useState("")
  const [expandedSession, setExpandedSession] = useState<number | null>(0)

  // Save state
  const [saving, setSaving] = useState(false)
  const [fallbackGenerating, setFallbackGenerating] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const selectedAthlete = athletes.find((a) => a.id === athleteId)
  const month = monthLabel(startDate, locale)

  // Edits are applied straight to the program; originalProgram keeps the AI's version for the learning step.
  const displayProgram = program
  const programChanged = !!program && !!originalProgram && JSON.stringify(program) !== JSON.stringify(originalProgram)
  const thinSessions = program ? sessionVolumeWarnings(program) : []

  function resetForNewProgram() {
    setProgram(null)
    setOriginalProgram(null)
    setAdminReason("")
    setEditMode(false)
    setSaveMsg(null)
    setExpandedSession(0)
  }

  async function handleFallbackGenerate() {
    setFallbackGenerating(true)
    setSaveMsg(null)
    try {
      const result = await generateLegacyFallbackProgram({ athleteId, startDate, time, weekdays: days })
      if (result.error || !result.data) {
        setGenError(result.error ?? t("Fallback generation failed."))
        return
      }
      setProgram(result.data)
      setOriginalProgram(result.data)
      setGenError(null)
    } catch (err) {
      setGenError(actionErrorMessage(err, t("Fallback generation failed."), t))
    } finally {
      setFallbackGenerating(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    resetForNewProgram()

    try {
      const result = await generateProgramWithAI({ athleteId, startDate, time, weekdays: days })
      if (result.error || !result.data) {
        setGenError(result.error ?? t("Generation failed."))
        return
      }
      setProgram(result.data)
      setOriginalProgram(result.data)
    } catch (err) {
      setGenError(actionErrorMessage(err, t("An unexpected error occurred while communicating with the server."), t))
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!displayProgram) return
    setSaving(true)
    setSaveMsg(null)

    try {
      // 1. Save the program first so the learning step can refer to it.
      const saved = await saveAIGeneratedProgram({ athleteId, startDate, time, weekdays: days, program: displayProgram })
      if (saved.error || !saved.id) {
        setSaveMsg(saved.error ?? t("Unable to save program."))
        return
      }

      // 2. If the coach edited it and explained why, ask the AI to PROPOSE a prompt improvement.
      //    The proposal is not applied until an admin approves it.
      // Every saved edit teaches the next generation (the typed reason is optional extra context).
      if (programChanged && originalProgram) {
        const learned = await saveAdminEditsAndLearn({
          programId: saved.id,
          editedProgram: displayProgram,
          originalProgram,
          adminReason: adminReason.trim() || "No reason given; infer the coach's preference from the changes.",
        })
        setSaveMsg(
          learned.error
            ? t("Program saved for admin review. The learning step failed: {error}", { error: learned.error })
            : t("Program saved for admin review. A prompt improvement was proposed and is waiting for admin approval."),
        )
        return
      }

      setSaveMsg(t("Program saved for admin review."))
    } catch (err) {
      setSaveMsg(`Error: ${actionErrorMessage(err, t("Unable to save program."), t)}`)
    } finally {
      setSaving(false)
    }
  }

  function editSession(sIdx: number, change: (exercises: GeminiExercise[]) => GeminiExercise[]) {
    setProgram((current) =>
      current
        ? { ...current, sessions: current.sessions.map((session, i) => (i === sIdx ? { ...session, exercises: change([...session.exercises]) } : session)) }
        : current,
    )
  }

  const fromCatalog = (exerciseId: string) => exercises.find((exercise) => exercise.id === exerciseId)

  function sessionEditor(sIdx: number): SessionEditor {
    return {
      update: (eIdx, field, value) => editSession(sIdx, (list) => list.map((ex, i) => (i === eIdx ? { ...ex, [field]: value } : ex))),
      replace: (eIdx, exerciseId) => {
        const picked = fromCatalog(exerciseId)
        if (!picked) return
        editSession(sIdx, (list) => list.map((ex, i) => (i === eIdx ? { ...ex, id: picked.id, name_en: picked.name_en, image_url: picked.image_url ?? null } : ex)))
      },
      move: (eIdx, direction) =>
        editSession(sIdx, (list) => {
          const to = eIdx + direction
          if (to < 0 || to >= list.length) return list
          ;[list[eIdx], list[to]] = [list[to], list[eIdx]]
          return list
        }),
      remove: (eIdx) => editSession(sIdx, (list) => list.filter((_, i) => i !== eIdx)),
      add: (exerciseId, section) => {
        const picked = fromCatalog(exerciseId)
        if (!picked) return
        const reps = picked.default_reps != null ? String(picked.default_reps) : "10"
        editSession(sIdx, (list) => [...list, { id: picked.id, name_en: picked.name_en, section, sets: picked.default_sets ?? 3, reps, load_percentage: null, notes: null, image_url: picked.image_url ?? null }])
      },
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      {/* ── Left panel ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-4 text-violet-500" />
            {t("AI program generation")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("Gemini designs a personalized 4-week plan from the athlete's profile, assessment scores, and sport season.")}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-athlete">{t("Athlete")}</Label>
            <AthletePicker
              id="ai-athlete"
              athletes={athletes}
              value={athleteId}
              onChange={(nextId) => {
                setAthleteId(nextId)
                setProgram(null)
                setGenError(null)
                setDays(defaultTrainingDays(athletes.find((athlete) => athlete.id === nextId)))
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-start">{t("Month start")}</Label>
            <Input id="ai-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-time">{t("Session time")}</Label>
            <div className="relative">
              <Clock3 className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input id="ai-time" className="pl-9" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">{t("Training days")}</legend>
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
                  {t(weekdayLabel(day))}
                </label>
              ))}
            </div>
          </fieldset>

          {selectedAthlete && !selectedAthlete.latest_assessment && (
            <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
              {t("No assessment data for this athlete. Gemini will design a conservative baseline program.")}
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!athleteId || !days.length || generating}
            className="gap-2 bg-violet-600 hover:bg-violet-700"
          >
            {generating ? (
              <><Loader2 className="size-4 animate-spin" />{t("Generating…")}</>
            ) : (
              <><Sparkles className="size-4" />{t("Generate with AI")}</>
            )}
          </Button>

          {genError && (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span className="leading-relaxed">{genError}</span>
              </div>
              {genError.includes("refresh") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-fit h-7 text-xs"
                  onClick={() => window.location.reload()}
                >
                  {t("Reload Page Now")}
                </Button>
              )}
              <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-foreground">
                <p className="font-semibold text-xs">{t("Automatic Fallback Available (Option B)")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("Generate this 4-week program immediately using Coach Ahmed's structured rules engine.")}
                </p>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="mt-2 w-full gap-1.5 h-8 text-xs font-semibold"
                  onClick={handleFallbackGenerate}
                  disabled={fallbackGenerating}
                >
                  {fallbackGenerating ? (
                    <><Loader2 className="size-3.5 animate-spin" /> {t("Generating with Rules Engine…")}</>
                  ) : (
                    <><Sparkles className="size-3.5" /> {t("Generate with Rules Engine Instead")}</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Right panel ── */}
      <div className="grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{selectedAthlete?.profiles?.full_name ?? t("Select an athlete")}</p>
            <h2 className="text-2xl font-semibold">{month}</h2>
          </div>
          <CalendarDays className="size-7 text-violet-500" />
        </div>

        {!displayProgram && !generating && (
          <Card>
            <CardContent className="flex min-h-64 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {t("Click \"Generate with AI\" to create a personalized program.")}
            </CardContent>
          </Card>
        )}

        {generating && (
          <Card>
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="size-8 animate-spin text-violet-500" />
              <p className="text-sm font-medium">{t("Gemini is designing the program…")}</p>
              <p className="text-xs text-muted-foreground">{t("This can take up to a minute.")}</p>
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

            {thinSessions.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {t("{count} session(s) have fewer than {minTotal} exercises or fewer than {minStrength} strength exercises.", { count: thinSessions.length, minTotal: 6, minStrength: 2 })}
              </div>
            )}

            {/* Edit toggle */}
            <div className="flex items-center gap-3">
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setEditMode((v) => !v)}
              >
                <Edit3 className="size-4" />
                {editMode ? t("Editing mode on") : t("Edit program")}
              </Button>
              {editMode && (
                <p className="text-xs text-muted-foreground">{t("Change, add, remove or reorder exercises in any session. Your changes teach future programs.")}</p>
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
                  editor={sessionEditor(sIdx)}
                  catalog={exercises}
                />
              ))}
            </div>

            {/* Admin edit reason (shown in edit mode) */}
            {editMode && (
              <div className="grid gap-2">
                <Label htmlFor="admin-reason">{t("Why did you make these changes? (optional, helps Gemini learn)")}</Label>
                <Textarea
                  id="admin-reason"
                  value={adminReason}
                  onChange={(e) => setAdminReason(e.target.value)}
                  placeholder={t("e.g. Replaced squats with leg press because athlete has knee issues...")}
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
                <><Loader2 className="size-4 animate-spin" />{t("Saving…")}</>
              ) : (
                <><Check className="size-4" />{t("Save for admin review")}</>
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
  editor,
  catalog,
}: {
  session: GeminiSession
  sIdx: number
  editMode: boolean
  expanded: boolean
  onToggle: () => void
  editor: SessionEditor
  catalog: AdminExercise[]
}) {
  const [addId, setAddId] = useState("")
  const [addSection, setAddSection] = useState<string>("Strength/Power")
  const { t, locale } = useLanguage()
  const dateLabel = new Date(`${session.date}T12:00:00`).toLocaleDateString(locale, {
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
            {t("Week {week}", { week: session.week })}
          </Badge>
          <div>
            <p className="text-sm font-semibold">{dateLabel}</p>
            <p className="text-xs text-muted-foreground">{t("{time} · {exercisesCount} exercises", { time: session.time, exercisesCount: session.exercises.length })}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 grid gap-3">
          {session.exercises.map((ex, eIdx) => (
            <ExerciseRow
              key={`${ex.id ?? ex.name_en}-${eIdx}`}
              exercise={ex}
              eIdx={eIdx}
              count={session.exercises.length}
              editMode={editMode}
              editor={editor}
              catalog={catalog}
            />
          ))}
          {editMode && (
            <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_160px_auto]">
              <select aria-label={t("Exercise to add")} value={addId} onChange={(e) => setAddId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">{t("Add an exercise…")}</option>
                {[...catalog].sort((a, b) => a.name_en.localeCompare(b.name_en)).map((item) => <option key={item.id} value={item.id}>{item.name_en}</option>)}
              </select>
              <select aria-label={t("Section")} value={addSection} onChange={(e) => setAddSection(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                {PROGRAM_SECTIONS.map((section) => <option key={section} value={section}>{t(section)}</option>)}
              </select>
              <Button type="button" size="sm" variant="outline" className="gap-1" disabled={!addId} onClick={() => { editor.add(addId, addSection); setAddId("") }}>
                <Plus className="size-4" />{t("Add")}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Exercise row ─────────────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  eIdx,
  count,
  editMode,
  editor,
  catalog,
}: {
  exercise: GeminiExercise
  eIdx: number
  count: number
  editMode: boolean
  editor: SessionEditor
  catalog: AdminExercise[]
}) {
  const { t } = useLanguage()
  const onEdit = (field: keyof GeminiExercise, value: unknown) => editor.update(eIdx, field, value)
  if (!editMode) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(exercise.section)} · </span>
          <span className="font-medium">{exercise.name_en}</span>
          {exercise.notes && <p className="mt-0.5 text-xs text-muted-foreground">{exercise.notes}</p>}
          <div className="mt-1"><ExerciseMediaPreview exercise={exercise} catalog={catalog} /></div>
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
      <div className="flex items-center justify-between gap-2">
        <select aria-label={t("Section")} value={exercise.section} onChange={(e) => onEdit("section", e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs font-medium uppercase tracking-wide">
          {PROGRAM_SECTIONS.map((section) => <option key={section} value={section}>{t(section)}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={t("Move up")} disabled={eIdx === 0} onClick={() => editor.move(eIdx, -1)}><ArrowUp className="size-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={t("Move down")} disabled={eIdx === count - 1} onClick={() => editor.move(eIdx, 1)}><ArrowDown className="size-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" aria-label={t("Remove exercise")} onClick={() => editor.remove(eIdx)}><Trash2 className="size-4" /></Button>
        </div>
      </div>
      <select aria-label={t("Exercise")} value={exercise.id ?? ""} onChange={(e) => editor.replace(eIdx, e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm font-medium">
        {!exercise.id || !catalog.some((item) => item.id === exercise.id) ? <option value={exercise.id ?? ""}>{exercise.name_en}</option> : null}
        {[...catalog].sort((a, b) => a.name_en.localeCompare(b.name_en)).map((item) => <option key={item.id} value={item.id}>{item.name_en}</option>)}
      </select>
      <ExerciseMediaPreview exercise={exercise} catalog={catalog} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">{t("Sets")}</Label>
          <Input
            type="number"
            min="1"
            value={exercise.sets}
            onChange={(e) => onEdit("sets", Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">{t("Reps")}</Label>
          <Input
            value={exercise.reps}
            onChange={(e) => onEdit("reps", e.target.value)}
            className="h-8 text-sm"
            placeholder="8-12"
          />
        </div>
        <div>
          <Label className="text-xs">{t("Load %")}</Label>
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
        <Label className="text-xs">{t("Coaching notes")}</Label>
        <Input
          value={exercise.notes ?? ""}
          onChange={(e) => onEdit("notes", e.target.value || null)}
          className="h-8 text-sm"
          placeholder={t("Optional coaching cue...")}
        />
      </div>
    </div>
  )
}
