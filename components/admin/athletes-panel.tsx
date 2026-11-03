"use client"

import { useMemo, useState } from "react"
import { Search, UserRound } from "lucide-react"
import { importAthletesCsv } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AthleteDrawer } from "@/components/admin/athlete-drawer"
import type { AthleteSessionSummary, AthleteExercisePain } from "@/components/admin/athlete-feedback-panel"

// ─── props ────────────────────────────────────────────────────────────────────

type AthletePanelProps = {
  athletes: any[]
  selfies?: any[]
  feedbackSummaries?: AthleteSessionSummary[]
  feedbackPainReports?: AthleteExercisePain[]
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function AthletesPanel({
  athletes,
  selfies = [],
  feedbackSummaries = [],
  feedbackPainReports = [],
}: AthletePanelProps) {
  const [query, setQuery] = useState("")
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [selectedAthlete, setSelectedAthlete] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Count unread selfies per athlete
  const selfieCountById = useMemo(
    () =>
      selfies.reduce<Record<string, number>>((acc, s) => {
        acc[s.athlete_id] = (acc[s.athlete_id] ?? 0) + 1
        return acc
      }, {}),
    [selfies]
  )

  // Count pain reports per athlete
  const painCountById = useMemo(
    () =>
      feedbackPainReports.reduce<Record<string, number>>((acc, p) => {
        acc[p.athlete_id] = (acc[p.athlete_id] ?? 0) + 1
        return acc
      }, {}),
    [feedbackPainReports]
  )

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return athletes
    return athletes.filter((athlete) => {
      const name = athlete.profiles?.full_name ?? athlete.full_name ?? ""
      const troyId = athlete.profiles?.troy_id ?? ""
      const email = athlete.auth_email ?? ""
      return `${name} ${troyId} ${email}`.toLowerCase().includes(term)
    })
  }, [athletes, query])

  function openAthlete(athlete: any) {
    setSelectedAthlete(athlete)
    setDrawerOpen(true)
  }

  return (
    <div className="grid gap-6">
      {/* Search + import */}
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Athletes</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {athletes.length} athlete{athletes.length === 1 ? "" : "s"} in your roster. Click any row to open their full profile.
            </p>
          </div>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setImporting(true)
              setImportMessage(null)
              console.log("[Athletes-Panel] Starting CSV athlete import")
              try {
                const result = await importAthletesCsv(new FormData(event.currentTarget))
                console.log("[Athletes-Panel] CSV import result:", result)
                setImportMessage(result.error ?? `Imported ${result.imported ?? 0} athletes.`)
              } catch (err: any) {
                console.error("[Athletes-Panel] CSV import error:", err)
                if (err?.message?.includes("Server Action") || String(err).includes("UnrecognizedActionError")) {
                  setImportMessage("App was recently updated. Please refresh the page (Ctrl + F5).")
                } else {
                  setImportMessage(err?.message ?? "An error occurred during CSV import.")
                }
              } finally {
                setImporting(false)
              }
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <Input type="file" name="file" accept=".csv,text/csv" className="max-w-xs" />
            <Button type="submit" variant="outline" disabled={importing}>
              {importing ? "Importing…" : "Import CSV"}
            </Button>
          </form>
          {importMessage && (
            <p role="status" className="text-xs text-muted-foreground">
              {importMessage}
            </p>
          )}
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              aria-label="Search athletes"
              placeholder="Search name, Troy ID…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Roster list */}
      <section aria-label="Athlete roster">
        <div className="divide-y rounded-xl border overflow-hidden">
          {filtered.map((athlete) => {
            const profile = athlete.profiles ?? {}
            const name = profile.full_name ?? athlete.full_name ?? "Unnamed athlete"
            const troyId = profile.troy_id ?? null
            const team = athlete.athlete_teams?.[0]?.teams
            const isPaused = athlete.account_status === "paused"
            const selfieCount = selfieCountById[athlete.id] ?? 0
            const painCount = painCountById[athlete.id] ?? 0

            return (
              <button
                key={athlete.id}
                type="button"
                onClick={() => openAthlete(athlete)}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                aria-label={`Open profile for ${name}`}
              >
                {/* Avatar */}
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  {team?.image_url ? (
                    <img src={team.image_url} alt="" className="size-9 rounded-full object-cover" />
                  ) : (
                    <UserRound className="size-4.5" />
                  )}
                </div>

                {/* Name + id */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {troyId ?? athlete.auth_email ?? "—"}
                    {team?.name_en ? ` · ${team.name_en}` : ""}
                    {athlete.sport ? ` · ${athlete.sport}` : ""}
                  </p>
                </div>

                {/* Badges */}
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {isPaused && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 text-xs">
                      Paused
                    </Badge>
                  )}
                  {selfieCount > 0 && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 text-xs">
                      {selfieCount} selfie{selfieCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {painCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {painCount} pain
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs capitalize">
                    {athlete.assessment_status?.replaceAll("_", " ") ?? "not started"}
                  </Badge>
                </div>
              </button>
            )
          })}

          {!filtered.length && (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No athletes match this search.
            </div>
          )}
        </div>
      </section>

      {/* Athlete drawer */}
      {selectedAthlete && (
        <AthleteDrawer
          athlete={selectedAthlete}
          selfies={selfies}
          summaries={feedbackSummaries}
          painReports={feedbackPainReports}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      )}
    </div>
  )
}

// ─── stats row ────────────────────────────────────────────────────────────────

export function AthleteStats({ athletes }: { athletes: any[] }) {
  const assessed = athletes.filter((a) => a.assessment_status === "approved").length
  const paused = athletes.filter((a) => a.account_status === "paused").length
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{athletes.length}</p>
          <p className="text-xs text-muted-foreground">Total athletes</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{assessed}</p>
          <p className="text-xs text-muted-foreground">Assessed</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{athletes.length - assessed}</p>
          <p className="text-xs text-muted-foreground">Pending assessment</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{paused}</p>
          <p className="text-xs text-muted-foreground">Paused</p>
        </CardContent>
      </Card>
    </div>
  )
}
