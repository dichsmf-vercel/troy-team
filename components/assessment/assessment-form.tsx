"use client"

import { useState, useTransition } from "react"
import { submitAssessment, uploadAssessmentPhoto } from "@/app/assessment/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function AssessmentForm({ equipmentOptions = [] }: { equipmentOptions?: string[] }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  function submit(action: (data: FormData) => Promise<{ error: string | null }>, event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await action(data); setMessage(result.error || "Saved for Coach Ahmed review.") }) }
  return <div className="grid gap-6">
    <form onSubmit={(event) => submit(submitAssessment, event)} className="grid gap-4 rounded-xl border bg-card p-5">
      <div><h1 className="text-2xl font-semibold">Athlete assessment</h1><p className="text-sm text-muted-foreground">Tell Coach Ahmed what you need so your monthly plan can be generated safely.</p></div>
      <div className="grid gap-2"><Label htmlFor="training_days">Training days per week</Label><Input id="training_days" name="training_days" type="number" min="1" max="7" required /></div>
      <div className="grid gap-2"><Label htmlFor="experience">Experience and current level</Label><Textarea id="experience" name="experience" required /></div>
      <div className="grid gap-2"><Label htmlFor="equipment">Available equipment</Label><select id="equipment" name="equipment" multiple className="min-h-28 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm" aria-describedby="equipment-help">{equipmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><p id="equipment-help" className="text-xs text-muted-foreground">Select all equipment you can use. Hold Ctrl/Cmd to select multiple options.</p></div>
      <div className="grid gap-2"><Label htmlFor="injury_flags">Injuries or limitations</Label><Textarea id="injury_flags" name="injury_flags" placeholder="Separate items with commas" /></div>
      <div className="grid gap-2"><Label htmlFor="goals">Goals</Label><Textarea id="goals" name="goals" placeholder="Separate goals with commas" required /></div>
      <div className="grid gap-2"><Label htmlFor="medical_notes">Medical notes</Label><Textarea id="medical_notes" name="medical_notes" /></div>
      <Button disabled={pending}>{pending ? "Submitting..." : "Submit assessment"}</Button>
    </form>
    <form onSubmit={(event) => submit(uploadAssessmentPhoto, event)} className="grid gap-4 rounded-xl border bg-card p-5"><div><h2 className="font-semibold">Assessment image</h2><p className="text-sm text-muted-foreground">Upload an InBody or assessment screenshot for your admin and coach to review.</p></div><div className="grid gap-2"><Label htmlFor="assessment_photo">Image</Label><Input id="assessment_photo" name="assessment_photo" type="file" accept="image/png,image/jpeg,image/webp" /></div><Button variant="outline" disabled={pending}>{pending ? "Uploading..." : "Upload assessment image"}</Button></form>
    {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
  </div>
}
