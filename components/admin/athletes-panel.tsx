"use client"

import { useMemo, useState } from "react"
import { Search, UserRound } from "lucide-react"
import { sendAthleteInvitation } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function AthletesPanel({ athletes }: { athletes: any[] }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return athletes
    return athletes.filter((athlete) => {
      const name = athlete.profiles?.full_name ?? athlete.full_name ?? ""
      const email = athlete.profiles?.email ?? athlete.email ?? ""
      return `${name} ${email}`.toLowerCase().includes(term)
    })
  }, [athletes, query])

  return <div className="grid gap-6">
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><CardTitle>Athletes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Read-only athlete information for admin review.</p></div>
        <div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search athletes" placeholder="Search athletes" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></div>
      </CardHeader>
    </Card>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Athlete roster">
      {filtered.map((athlete) => {
        const profile = athlete.profiles ?? {}
        const team = athlete.athlete_teams?.[0]?.teams
        const name = profile.full_name ?? athlete.full_name ?? "Unnamed athlete"
        return <Card key={athlete.id} className="overflow-hidden">
          <CardContent className="grid gap-4 p-5">
            <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><UserRound className="size-5" /></div><div className="min-w-0"><h2 className="truncate font-semibold">{name}</h2><p className="truncate text-sm text-muted-foreground">{profile.email ?? athlete.email ?? "No email"}</p></div></div>
            <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Phone</dt><dd>{athlete.phone ?? "—"}</dd></div><div><dt className="text-muted-foreground">Team</dt><dd>{team?.name_en ?? "Individual"}</dd></div><div><dt className="text-muted-foreground">Height</dt><dd>{athlete.height_cm ? `${athlete.height_cm} cm` : "—"}</dd></div><div><dt className="text-muted-foreground">Weight</dt><dd>{athlete.weight_kg ? `${athlete.weight_kg} kg` : "—"}</dd></div><div><dt className="text-muted-foreground">Tier</dt><dd className="capitalize">{athlete.tier ?? "—"}</dd></div><div><dt className="text-muted-foreground">Assessment</dt><dd className="capitalize">{athlete.assessment_status?.replaceAll("_", " ") ?? "—"}</dd></div></dl>
            <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">Coach notes</p><p className="mt-1 line-clamp-3 text-muted-foreground">{profile.coach_private_notes ?? athlete.injury_notes ?? athlete.goals ?? "No notes recorded."}</p></div><form action={async () => { await sendAthleteInvitation(athlete.id) }}><Button type="submit" variant="outline" className="w-full">Send invitation</Button></form>
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
