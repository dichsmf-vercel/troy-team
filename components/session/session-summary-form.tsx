"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useLanguage } from "@/components/providers/language-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { submitSessionSummary } from "@/app/(athlete)/session/[sessionPostId]/summary-actions"

const SYMPTOM_KEYS = ["fatigue", "muscleSoreness", "jointPain", "dizziness", "none"] as const

const SYMPTOM_LABELS: Record<(typeof SYMPTOM_KEYS)[number], { en: string; ar: string }> = {
  fatigue: { en: "Fatigue", ar: "تعب" },
  muscleSoreness: { en: "Muscle soreness", ar: "ألم عضلي" },
  jointPain: { en: "Joint pain", ar: "ألم في المفاصل" },
  dizziness: { en: "Dizziness", ar: "دوخة" },
  none: { en: "None", ar: "لا شيء" },
}

export function SessionSummaryForm({
  sessionAthleteId,
  sessionPostId,
}: {
  sessionAthleteId: string
  sessionPostId: string
}) {
  const { dict, language } = useLanguage()
  const [rpe, setRpe] = useState(5)
  const [overallRating, setOverallRating] = useState(3)
  const [sleepQuality, setSleepQuality] = useState(3)
  const [sorenessLevel, setSorenessLevel] = useState(3)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [feedbackText, setFeedbackText] = useState("")
  const [isPending, startTransition] = useTransition()

  function toggleSymptom(key: string) {
    setSymptoms((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]))
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitSessionSummary(sessionAthleteId, sessionPostId, {
        rpe,
        overallRating,
        sleepQuality,
        sorenessLevel,
        symptoms,
        feedbackText,
      })
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-6">
      <h1 className="text-balance text-xl font-semibold tracking-tight">{dict.summary.title}</h1>

      <Card className="flex flex-col gap-3 p-4">
        <Label>
          {dict.summary.rpe}: <span className="tabular font-semibold">{rpe}</span>
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground">{dict.summary.rpeHint}</p>
        <Slider value={[rpe]} min={1} max={10} step={1} onValueChange={(v) => setRpe(v[0])} />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <Label>
          {dict.summary.overallRating}: <span className="tabular font-semibold">{overallRating}</span>
        </Label>
        <Slider
          value={[overallRating]}
          min={1}
          max={5}
          step={1}
          onValueChange={(v) => setOverallRating(v[0])}
        />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <Label>
          {dict.summary.sleepQuality}: <span className="tabular font-semibold">{sleepQuality}</span>
        </Label>
        <Slider value={[sleepQuality]} min={1} max={5} step={1} onValueChange={(v) => setSleepQuality(v[0])} />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <Label>
          {dict.summary.sorenessLevel}: <span className="tabular font-semibold">{sorenessLevel}</span>
        </Label>
        <Slider
          value={[sorenessLevel]}
          min={1}
          max={5}
          step={1}
          onValueChange={(v) => setSorenessLevel(v[0])}
        />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <Label>{dict.summary.symptoms}</Label>
        <div className="flex flex-col gap-2">
          {SYMPTOM_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-3">
              <Checkbox
                id={`symptom-${key}`}
                checked={symptoms.includes(key)}
                onCheckedChange={() => toggleSymptom(key)}
              />
              <Label htmlFor={`symptom-${key}`} className="text-sm font-normal">
                {SYMPTOM_LABELS[key][language]}
              </Label>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <Label htmlFor="feedback">{dict.summary.feedback}</Label>
        <Textarea
          id="feedback"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder={dict.summary.feedbackPlaceholder}
          rows={4}
        />
      </Card>

      <Button size="lg" onClick={handleSubmit} disabled={isPending}>
        {dict.summary.submit}
      </Button>
    </div>
  )
}
