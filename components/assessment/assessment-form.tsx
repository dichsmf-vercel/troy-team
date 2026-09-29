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
  function submit(action: (data: FormData) => Promise<{ error: string | null }>, event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const isPhotoUpload = action === uploadAssessmentPhoto; const data = new FormData(form); const file = data.get("assessment_photo"); console.group(`[assessment-debug] ${isPhotoUpload ? "Upload InBody image" : "Submit assessment"}`); console.log("Click received", { form: isPhotoUpload ? "assessment-image" : "assessment-details", pending, fields: [...data.keys()], file: file instanceof File ? { name: file.name, type: file.type, size: file.size } : null }); startTransition(async () => { console.log("[assessment-debug] Server action starting"); try { const result = await action(data); console.log("[assessment-debug] Server action completed", { ok: !result.error, error: result.error ?? null }); setMessage(result.error || (isPhotoUpload ? "InBody image uploaded successfully." : "Assessment submitted successfully.")); if (!result.error && action === submitAssessment) form.reset() } catch (error) { console.error("[assessment-debug] Server action failed", error); setMessage("Something went wrong. Please try again.") } finally { console.groupEnd() } }) }
  return <div className="grid gap-6">
    <form onSubmit={(event) => submit(submitAssessment, event)} className="grid gap-4 rounded-xl border bg-card p-5">
      <div><h1 className="text-2xl font-semibold">Athlete assessment</h1><p className="text-sm text-muted-foreground">Tell Coach Ahmed what you need so your monthly plan can be generated safely.</p></div>
      <div className="grid gap-2"><Label htmlFor="experience">Experience and current level</Label><Textarea id="experience" name="experience" required /></div>
      <div className="grid gap-2"><Label htmlFor="equipment">Available equipment</Label><select id="equipment" name="equipment" multiple className="min-h-28 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm" aria-describedby="equipment-help">{equipmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><p id="equipment-help" className="text-xs text-muted-foreground">Hold Ctrl on Windows/Linux or Cmd on Mac to select multiple options.</p></div>
      <div className="grid gap-2"><Label htmlFor="injury_flags">Injuries or limitations</Label><Textarea id="injury_flags" name="injury_flags" placeholder="Separate items with commas" /></div>
      <div className="grid gap-2"><Label htmlFor="goals">Goals</Label><Textarea id="goals" name="goals" placeholder="Separate goals with commas" required /></div>
      <div className="grid gap-2"><Label htmlFor="medical_notes">Medical notes</Label><Textarea id="medical_notes" name="medical_notes" /></div>
      <Button type="submit" disabled={pending} onClick={() => console.log("[assessment-debug] Submit assessment button clicked", { pending })}>{pending ? "Submitting..." : "Submit assessment"}</Button>
    </form>
    <form onSubmit={(event) => submit(uploadAssessmentPhoto, event)} className="grid gap-4 rounded-xl border bg-card p-5"><div><h2 className="font-semibold">Assessment image</h2><p className="text-sm text-muted-foreground">Upload an InBody or assessment screenshot for your admin and coach to review.</p></div><div className="grid gap-2"><Label htmlFor="assessment_photo">Image</Label><Input id="assessment_photo" name="assessment_photo" type="file" accept="image/png,image/jpeg,image/webp" /></div><Button type="submit" variant="outline" disabled={pending} onClick={() => console.log("[assessment-debug] Upload assessment image button clicked", { pending, hasFile: Boolean((document.getElementById("assessment_photo") as HTMLInputElement | null)?.files?.length) })}>{pending ? "Uploading..." : "Upload assessment image"}</Button></form>
    {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
  </div>
}
