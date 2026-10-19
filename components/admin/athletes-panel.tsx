"use client"

import { useMemo, useState } from "react"
import { Search, UserRound } from "lucide-react"
import { generateTemporaryAthletePassword, importAthletesCsv, markExerciseSelfieReviewed, reviewSessionSelfie, permanentlyDeleteAthlete, toggleAthleteAccountStatus, updateAthleteAccountFromForm } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function AthletesPanel({ athletes, selfies = [] }: { athletes: any[]; selfies?: any[] }) {
  const [query, setQuery] = useState("")
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const selfiesByAthlete = useMemo(() => selfies.reduce((groups: Record<string, any[]>, selfie: any) => { groups[selfie.athlete_id] = [...(groups[selfie.athlete_id] ?? []), selfie]; return groups }, {}), [selfies])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return athletes
    return athletes.filter((athlete) => {
      const name = athlete.profiles?.full_name ?? athlete.full_name ?? ""
      const email = athlete.auth_email ?? athlete.profiles?.email ?? athlete.email ?? ""
      return `${name} ${email}`.toLowerCase().includes(term)
    })
  }, [athletes, query])

  return <div className="grid gap-6">
    <Card><CardHeader><CardTitle>Exercise selfie inbox</CardTitle><p className="text-sm text-muted-foreground">Each card belongs to one athlete. Every exercise has its own selfie. Open the image, mark it reviewed, and it will be permanently deleted to save storage.</p></CardHeader><CardContent>{selfies.length ? <div className="grid gap-5 md:grid-cols-2">{Object.entries(selfiesByAthlete).map(([athleteId, athleteSelfies]) => { const athlete = athletes.find((candidate) => candidate.id === athleteId); const athleteName = athlete?.profiles?.full_name ?? athlete?.full_name ?? "Unknown athlete"; return <Card key={athleteId} className="overflow-hidden"><CardHeader className="border-b bg-muted/30"><CardTitle className="text-base">{athleteName}</CardTitle><p className="text-xs text-muted-foreground">{athleteSelfies.length} exercise {athleteSelfies.length === 1 ? "selfie" : "selfies"} awaiting review</p></CardHeader><CardContent className="grid gap-4 p-4">{athleteSelfies.map((selfie: any) => <div key={selfie.id} className="grid gap-3 rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><div><p className="font-medium">Exercise {selfie.selfie_type === "program" ? (selfie.exercise_index + 1) : "—"}</p><p className="text-xs text-muted-foreground">{selfie.session_date ? `Session ${selfie.session_date} · ` : ""}{selfie.selfie_type === "session" ? "Assigned session · " : "Program · "}Uploaded {new Date(selfie.uploaded_at).toLocaleString()}</p></div><span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700">Unread</span></div>{selfie.image_url ? <a href={selfie.image_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg"><img src={selfie.image_url} alt={`${athleteName} selfie for exercise ${selfie.exercise_index + 1}`} className="aspect-video w-full object-cover transition-transform hover:scale-[1.02]" /></a> : <div className="grid aspect-video place-items-center rounded-lg bg-muted text-sm text-muted-foreground">Image unavailable</div>}<form action={async () => { const action = selfie.selfie_type === "session" ? reviewSessionSelfie : markExerciseSelfieReviewed; await action(selfie.id) }}><Button type="submit" variant="outline" className="w-full">Mark reviewed and delete</Button></form></div>)}</CardContent></Card>})}</div> : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No unread exercise selfies. New uploads will appear here under the athlete&apos;s card.</div>}</CardContent></Card>
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><CardTitle>Athletes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Read-only athlete information for admin review.</p></div><form onSubmit={async (event) => { event.preventDefault(); setImporting(true); setImportMessage(null); const result = await importAthletesCsv(new FormData(event.currentTarget)); setImportMessage(result.error ?? `Imported ${result.imported ?? 0} athletes.`); setImporting(false) }} className="flex flex-wrap items-center gap-2"><Input type="file" name="file" accept=".csv,text/csv" className="max-w-xs" /><Button type="submit" variant="outline" disabled={importing}>{importing ? "Importing..." : "Import athletes CSV"}</Button></form>{importMessage ? <p role="status" className="text-xs text-muted-foreground">{importMessage}</p> : null}
        <div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search athletes" placeholder="Search athletes" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></div>
      </CardHeader>
    </Card>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Athlete roster">
      {filtered.map((athlete) => {
        const profile = athlete.profiles ?? {}
        const phone = athlete.phone ?? profile.phone ?? ""
        const notes = athlete.coach_notes ?? athlete.injury_notes ?? athlete.goals ?? profile.coach_private_notes ?? ""
        const height = athlete.height_cm ?? athlete.latest_measurement?.height_cm ?? athlete.latest_inbody?.height_cm
        const weight = athlete.weight_kg ?? athlete.latest_measurement?.weight_kg ?? athlete.latest_inbody?.weight_kg
        const team = athlete.athlete_teams?.[0]?.teams
        const name = profile.full_name ?? athlete.full_name ?? "Unnamed athlete"
        return <Card key={athlete.id} className="overflow-hidden">
          <CardContent className="grid gap-4 p-5">
            <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><UserRound className="size-5" /></div><div className="min-w-0"><h2 className="truncate font-semibold">{name}</h2><p className="truncate text-sm text-muted-foreground">{athlete.auth_email || profile.email || athlete.email || "No email"}</p></div></div>
            <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Phone</dt><dd>{phone || "—"}</dd></div><div><dt className="text-muted-foreground">Team</dt><dd>{team?.name_en ?? "Individual"}</dd></div><div><dt className="text-muted-foreground">Height</dt><dd>{height ? `${height} cm` : "—"}</dd></div><div><dt className="text-muted-foreground">Weight</dt><dd>{weight ? `${weight} kg` : "—"}</dd></div><div><dt className="text-muted-foreground">Tier</dt><dd className="capitalize">{athlete.tier ?? "—"}</dd></div><div><dt className="text-muted-foreground">Assessment</dt><dd className="capitalize">{athlete.assessment_status?.replaceAll("_", " ") ?? "—"}</dd></div></dl>
            <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">Coach notes</p><p className="mt-1 line-clamp-3 text-muted-foreground">{notes || "No notes recorded."}</p></div><details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Edit athlete details</summary><form action={updateAthleteAccountFromForm} className="mt-3 grid gap-3"><input type="hidden" name="athlete_id" value={athlete.id} /><Input name="full_name" aria-label="Full name" defaultValue={name} placeholder="Full name" required /><Input name="phone" aria-label="Phone" defaultValue={phone} placeholder="Phone" /><div className="grid grid-cols-2 gap-2"><Input name="height_cm" aria-label="Height in centimeters" type="number" min="1" step="0.1" defaultValue={height ?? ""} placeholder="Height cm" /><Input name="weight_kg" aria-label="Weight in kilograms" type="number" min="1" step="0.1" defaultValue={weight ?? ""} placeholder="Weight kg" /></div><Input name="private_notes" aria-label="Private notes" defaultValue={notes} placeholder="Private notes" /><Button type="submit" variant="secondary">Save athlete details</Button></form></details><form action={async () => { const result = await generateTemporaryAthletePassword(athlete.id); setTemporaryPassword(result.error ? null : result.temporaryPassword ?? null); setInviteMessage(result.error ?? "Temporary password generated. Copy it now; it will not be shown again.") }}><Button type="submit" variant="outline" className="w-full">Generate temporary password</Button></form>{temporaryPassword ? <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">Temporary password: <code className="font-mono font-semibold">{temporaryPassword}</code></p> : null}<form action={async () => { const nextStatus = athlete.account_status === "paused" ? "active" : "paused"; const result = await toggleAthleteAccountStatus(athlete.id, nextStatus); setInviteMessage(result.error ?? `Account ${nextStatus}.`) }}><Button type="submit" variant="secondary" className="w-full">{athlete.account_status === "paused" ? "Resume account" : "Pause account"}</Button></form><form onSubmit={async (event) => { event.preventDefault(); if (!window.confirm(`Permanently delete ${name}? This removes the account, assessments, measurements, programs, sessions, teams, and uploaded records.`)) return; const result = await permanentlyDeleteAthlete(athlete.id); setInviteMessage(result.error ?? "Athlete permanently deleted.") }}><Button type="submit" variant="destructive" className="w-full">Permanently delete athlete</Button></form>{inviteMessage ? <p role="status" className="text-xs text-muted-foreground">{inviteMessage}</p> : null}
          </CardContent>
        </Card>
      })}
      {!filtered.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No athletes match this search.</div> : null}
    </section>
  </div>
}

export function AthleteStats({ athletes }: { athletes: any[] }) {
  const assessed = athletes.filter((athlete) => athlete.assessment_status === "complete").length
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Card><CardContent className="p-4"><p className="text-2xl font-semibold">{athletes.length}</p><p className="text-xs text-muted-foreground">Total athletes</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-2xl font-semibold">{assessed}</p><p className="text-xs text-muted-foreground">Assessed</p></CardContent></Card></div>
}
