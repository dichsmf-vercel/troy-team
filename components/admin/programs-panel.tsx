"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createProgram, deleteProgram } from "@/app/admin/actions"

export function ProgramsPanel({ programs = [], exercises = [] }: { programs?: any[]; exercises?: any[] }) {
  const [items, setItems] = useState(programs)
  return <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
    <Card><CardHeader><CardTitle>Create program</CardTitle></CardHeader><CardContent><form action={createProgram} className="grid gap-3"><div className="grid gap-2"><Label htmlFor="program-name">Name</Label><Input id="program-name" name="name_en" required /></div><div className="grid gap-2"><Label htmlFor="program-ar">Arabic name</Label><Input id="program-ar" name="name_ar" /></div><div className="grid gap-2"><Label htmlFor="program-description">Description</Label><Textarea id="program-description" name="description_en" rows={3} /></div><div className="grid gap-2"><Label htmlFor="program-status">Status</Label><select id="program-status" name="status" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div><fieldset className="grid gap-2"><legend className="text-sm font-medium">Exercises</legend>{exercises.map((exercise) => <label key={exercise.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="exercise_id" value={exercise.id} />{exercise.name_en}</label>)}</fieldset><Button type="submit">Create program</Button></form></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{items.length ? items.map((program) => <Card key={program.id}><CardHeader><CardTitle>{program.name_en}</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">{program.description_en || "No description"}</p><p className="text-xs uppercase text-muted-foreground">{program.status}</p><Button type="button" variant="outline" onClick={async () => { await deleteProgram(program.id); setItems(items.filter((item) => item.id !== program.id)) }}>Delete</Button></CardContent></Card>) : <p className="text-sm text-muted-foreground">No programs yet.</p>}</div>
  </div>
}

export default ProgramsPanel
