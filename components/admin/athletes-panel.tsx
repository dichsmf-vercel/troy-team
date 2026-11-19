"use client"

import { firstRelation } from "@/lib/utils"
import { useMemo, useState } from "react"
import { Search, UserRound, Filter, SlidersHorizontal, AlertTriangle, Camera } from "lucide-react"
import { importAthletesCsv } from "@/app/admin/actions/imports"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ExcelAthleteImport } from "@/components/admin/excel-athlete-import"
import { AthleteDrawer } from "@/components/admin/athlete-drawer"
import { actionErrorMessage, isStaleActionError } from "@/lib/client-errors"
import type { AthleteSessionSummary, AthleteExercisePain } from "@/components/admin/athlete-feedback-panel"
import type { AdminAthlete, AdminAthleteProfile, AdminSelfie } from "@/lib/admin/types"
import { fieldValue, sportLabel, statusLabel } from "@/lib/i18n/labels"
import { useT, useLn } from "@/components/providers/language-provider"

// ─── props ────────────────────────────────────────────────────────────────────

type AthletePanelProps = {
  athletes: AdminAthlete[]
  selfies?: AdminSelfie[]
  feedbackSummaries?: AthleteSessionSummary[]
  feedbackPainReports?: AthleteExercisePain[]
}

type FilterStatus = "all" | "active" | "paused" | "pain" | "selfies"

// ─── main ─────────────────────────────────────────────────────────────────────

export function AthletesPanel({
  athletes,
  selfies = [],
  feedbackSummaries = [],
  feedbackPainReports = [],
}: AthletePanelProps) {
  const t = useT()
  const ln = useLn()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
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
    return athletes.filter((athlete) => {
      const name = athlete.profiles?.full_name ?? athlete.full_name ?? ""
      const troyId = athlete.profiles?.troy_id ?? ""
      const email = athlete.auth_email ?? ""
      const sport = athlete.sport ?? ""
      const matchesSearch = !term || `${name} ${troyId} ${email} ${sport}`.toLowerCase().includes(term)
      if (!matchesSearch) return false

      if (statusFilter === "active") return athlete.account_status !== "paused"
      if (statusFilter === "paused") return athlete.account_status === "paused"
      if (statusFilter === "pain") return (painCountById[athlete.id] ?? 0) > 0
      if (statusFilter === "selfies") return (selfieCountById[athlete.id] ?? 0) > 0

      return true
    })
  }, [athletes, query, statusFilter, painCountById, selfieCountById])

  function openAthlete(athlete: AdminAthlete) {
    setSelectedAthlete(athlete)
    setDrawerOpen(true)
  }

  const pausedCount = athletes.filter((a) => a.account_status === "paused").length
  const totalPainAthletes = athletes.filter((a) => (painCountById[a.id] ?? 0) > 0).length
  const totalSelfieAthletes = athletes.filter((a) => (selfieCountById[a.id] ?? 0) > 0).length

  return (
    <div className="grid gap-5">
      {/* Search + import bar */}
      <Card>
        <CardHeader className="gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">{t("Athlete Roster")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Manage profiles, assessments, training schedules, and direct credentials.")}
              </p>
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault()
                setImporting(true)
                setImportMessage(null)
                try {
                  const result = await importAthletesCsv(new FormData(event.currentTarget))
                  setImportMessage(result.error ?? t.plural(result.imported ?? 0, "Imported {count} athlete.", "Imported {count} athletes."))
                } catch (err) {
                  if (isStaleActionError(err)) {
                    setImportMessage(t("App was recently updated. Please refresh the page (Ctrl + F5)."))
                  } else {
                    setImportMessage(actionErrorMessage(err, t(t("An error occurred during CSV import.")), t))
                  }
                } finally {
                  setImporting(false)
                }
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <Input type="file" name="file" accept=".csv,text/csv" className="h-8 text-xs max-w-xs" />
              <Button type="submit" variant="outline" size="sm" disabled={importing} className="h-8 text-xs">
                {importing ? t("Importing…") : t("Import CSV")}
              </Button>
            </form>
          </div>

          {importMessage && (
            <p role="status" className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
              {importMessage}
            </p>
          )}

          {/* Search and filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label={t("Search athletes")}
                placeholder={t("Search name, Troy ID, sport…")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t("All ({athletesCount})", { athletesCount: athletes.length })}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  statusFilter === "active" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t("Active ({count})", { count: athletes.length - pausedCount })}
              </button>
              {pausedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("paused")}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    statusFilter === "paused" ? "bg-amber-600 text-white" : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                  }`}
                >
                  {t("Paused ({pausedCount})", { pausedCount })}
                </button>
              )}
              {totalPainAthletes > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("pain")}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    statusFilter === "pain" ? "bg-red-600 text-white" : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                  }`}
                >
                  {t("Pain reports ({totalPainAthletes})", { totalPainAthletes })}
                </button>
              )}
              {totalSelfieAthletes > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("selfies")}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    statusFilter === "selfies" ? "bg-violet-600 text-white" : "bg-violet-500/10 text-violet-700 hover:bg-violet-500/20"
                  }`}
                >
                  {t("Selfies ({totalSelfieAthletes})", { totalSelfieAthletes })}
                </button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <ExcelAthleteImport />

      {/* Roster list */}
      <section aria-label={t("Athlete roster")}>
        <div className="divide-y rounded-xl border bg-card overflow-hidden">
          {filtered.map((athlete) => {
            const profile: Partial<AdminAthleteProfile> = athlete.profiles ?? {}
            const name = profile.full_name ?? athlete.full_name ?? t("Unnamed athlete")
            const nameAr = profile.full_name_ar ?? null
            const troyId = profile.troy_id ?? null
            const team = firstRelation(athlete.athlete_teams?.[0]?.teams)
            const isPaused = athlete.account_status === "paused"
            const isAssignedOnly = athlete.goals?.includes("Assigned exercises only")
            const selfieCount = selfieCountById[athlete.id] ?? 0
            const painCount = painCountById[athlete.id] ?? 0

            return (
              <button
                key={athlete.id}
                type="button"
                onClick={() => openAthlete(athlete)}
                className="flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("Open profile for {name}", { name })}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-bold">
                    {team?.image_url ? (
                      <img src={team.image_url} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      <UserRound className="size-5" />
                    )}
                  </div>

                  {/* Name + id */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {name} {nameAr ? <span className="text-xs text-muted-foreground font-normal">({nameAr})</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono text-primary font-medium">{troyId ?? athlete.auth_email ?? "—"}</span>
                      {team?.name_en ? ` · ${ln(team.name_en, team.name_ar)}` : ""}
                      {sportLabel(t, athlete.sport) ? ` · ${sportLabel(t, athlete.sport).toLocaleUpperCase()}` : ""}
                      {fieldValue(athlete.position) ? ` (${fieldValue(athlete.position)})` : ""}
                    </p>
                  </div>
                </div>

                {/* Badges row */}
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-13 sm:pl-0 sm:justify-end">
                  {isPaused && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 text-[10px]">
                      {t("Paused")}
                    </Badge>
                  )}
                  {isAssignedOnly && (
                    <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                      {t("Assigned Only")}
                    </Badge>
                  )}
                  {selfieCount > 0 && (
                    <Badge variant="secondary" className="bg-violet-500/10 text-violet-700 text-[10px]">
                      <Camera className="mr-1 size-3" /> {selfieCount}
                    </Badge>
                  )}
                  {painCount > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      <AlertTriangle className="mr-1 size-3" /> {t("{painCount} pain", { painCount })}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {statusLabel(t, athlete.assessment_status)}
                  </Badge>
                </div>
              </button>
            )
          })}

          {!filtered.length && (
            <div className="rounded-xl p-8 text-center text-sm text-muted-foreground">
              {t("No athletes match this search or filter.")}
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


export function AthleteStats({ athletes }: { athletes: AdminAthlete[] }) {
  const t = useT()
  const ln = useLn()
  // "Assessed" = the coach has recorded test results (creation form / import / drawer), or the assessment was
  // submitted/approved. Counting only "approved" showed 0 because nothing sets that status today.
  const hasResults = (a: AdminAthlete) =>
    (a.assessment_answers ?? []).some((answer) => answer.question_key !== "bmi" && answer.question_key !== "fms_total" && answer.answer_json?.value != null && answer.answer_json.value !== "")
  const assessed = athletes.filter((a) => a.assessment_status === "approved" || a.assessment_status === "submitted" || hasResults(a)).length
  const paused = athletes.filter((a) => a.account_status === "paused").length
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{athletes.length}</p>
          <p className="text-xs text-muted-foreground">{t("Total athletes")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{assessed}</p>
          <p className="text-xs text-muted-foreground">{t("Assessed")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{athletes.length - assessed}</p>
          <p className="text-xs text-muted-foreground">{t("Pending assessment")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{paused}</p>
          <p className="text-xs text-muted-foreground">{t("Paused")}</p>
        </CardContent>
      </Card>
    </div>
  )
}
