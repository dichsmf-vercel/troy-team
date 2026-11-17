"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createProgram, deleteProgram } from "@/app/admin/actions/programs"
import { useT, useLn } from "@/components/providers/language-provider"
import type { AdminExercise, AdminProgram } from "@/lib/admin/types"

export function ProgramsPanel({ programs = [], exercises = [] }: { programs?: AdminProgram[]; exercises?: AdminExercise[] }) {
  const t = useT()
  const ln = useLn()
  const [items, setItems] = useState(programs)
  return <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
    <Card><CardHeader><CardTitle>{t("Create program")}</CardTitle></CardHeader><CardContent><form action={async (formData) => { await createProgram(formData) }} className="grid gap-3"><div className="grid gap-2"><Label htmlFor="program-name">{t("Name")}</Label><Input id="program-name" name="name_en" required /></div><div className="grid gap-2"><Label htmlFor="program-ar">{t("Arabic name")}</Label><Input id="program-ar" name="name_ar" /></div><div className="grid gap-2"><Label htmlFor="program-description">{t("Description")}</Label><Textarea id="program-description" name="description_en" rows={3} /></div><div className="grid gap-2"><Label htmlFor="program-status">{t("Status")}</Label><select id="program-status" name="status" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="draft">{t("Draft")}</option><option value="published">{t("Published")}</option><option value="archived">{t("Archived")}</option></select></div><fieldset className="grid gap-2"><legend className="text-sm font-medium">{t("Exercises")}</legend>{exercises.map((exercise) => <label key={exercise.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="exercise_id" value={exercise.id} />{ln(exercise.name_en, exercise.name_ar)}</label>)}</fieldset><Button type="submit">{t("Create program")}</Button></form></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{items.length ? items.map((program) => <Card key={program.id}><CardHeader><CardTitle>{ln(program.name_en, program.name_ar)}</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">{program.description_en || t("No description")}</p><p className="text-xs uppercase text-muted-foreground">{program.status}</p><Button type="button" variant="outline" onClick={async () => { await deleteProgram(program.id); setItems(items.filter((item) => item.id !== program.id)) }}>{t("Delete")}</Button></CardContent></Card>) : <p className="text-sm text-muted-foreground">{t("No programs yet.")}</p>}</div>
  </div>
}

export default ProgramsPanel
