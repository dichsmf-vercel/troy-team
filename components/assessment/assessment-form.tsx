"use client"

import { useState, useTransition } from "react"
import { submitAssessment, saveInbody } from "@/app/assessment/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function AssessmentForm() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  function submit(action: (data: FormData) => Promise<{ error: string | null }>, event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await action(data); setMessage(result.error || "Saved for Coach Ahmed review.") }) }
  return <div className="grid gap-6">
    <form onSubmit={(event) => submit(submitAssessment, event)} className="grid gap-4 rounded-xl border bg-card p-5">
      <div><h1 className="text-2xl font-semibold">Athlete assessment</h1><p className="text-sm text-muted-foreground">Tell Coach Ahmed what you need so your monthly plan can be generated safely.</p></div>
      <div className="grid gap-2"><Label htmlFor="training_days">Training days per week</Label><Input id="training_days" name="training_days" type="number" min="1" max="7" required /></div>
      <div className="grid gap-2"><Label htmlFor="experience">Experience and current level</Label><Textarea id="experience" name="experience" required /></div>
      <div className="grid gap-2"><Label htmlFor="equipment">Available equipment</Label><Input id="equipment" name="equipment" placeholder="Gym, pitch, bands..." /></div>
      <div className="grid gap-2"><Label htmlFor="injury_flags">Injuries or limitations</Label><Textarea id="injury_flags" name="injury_flags" placeholder="Separate items with commas" /></div>
      <div className="grid gap-2"><Label htmlFor="goals">Goals</Label><Textarea id="goals" name="goals" placeholder="Separate goals with commas" required /></div>
      <div className="grid gap-2"><Label htmlFor="medical_notes">Medical notes</Label><Textarea id="medical_notes" name="medical_notes" /></div>
      <Button disabled={pending}>{pending ? "Submitting..." : "Submit assessment"}</Button>
    </form>
    <form onSubmit={(event) => submit(saveInbody, event)} className="grid gap-4 rounded-xl border bg-card p-5"><div><h2 className="font-semibold">InBody measurements</h2><p className="text-sm text-muted-foreground">Optional measurements to improve plan recommendations.</p></div><div className="grid grid-cols-2 gap-3">{[["weight_kg","Weight (kg)"],["height_cm","Height (cm)"],["body_fat_pct","Body fat (%)"],["muscle_mass_kg","Muscle mass (kg)"],["bmi","BMI"]].map(([name,label]) => <div className="grid gap-2" key={name}><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type="number" step="0.1" /></div>)}</div><Textarea name="notes" placeholder="Notes" /><Button variant="outline" disabled={pending}>Save measurements</Button></form>
    {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
  </div>
}
