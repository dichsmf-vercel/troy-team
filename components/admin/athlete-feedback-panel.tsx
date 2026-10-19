"use client"

import { useState } from "react"
import { Activity, AlertTriangle, ChevronDown, ChevronUp, HeartPulse, MessageSquare, Search, Smile, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

// ─── types ────────────────────────────────────────────────────────────────────

export type AthleteSessionSummary = {
  id: string
  athlete_id: string
  session_post_id: string
  session_title: string
  session_date: string
  submitted_at: string
  rpe: number | null
  overall_rating: number | null
  sleep_quality: number | null
  soreness_level: number | null
  symptoms: string[] | null
  feedback_text: string | null
}

export type AthleteExercisePain = {
  id: string
  athlete_id: string
  session_post_id: string
  session_title: string
  session_date: string
  exercise_name: string
  pain_location: string | null
  pain_severity: number | null
  pain_notes: string | null
  reported_at: string
}

type Props = {
  athletes: any[]
  summaries: AthleteSessionSummary[]
  painReports: AthleteExercisePain[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function rpeColor(rpe: number | null) {
  if (rpe == null) return "text-muted-foreground"
  if (rpe >= 8) return "text-red-500"
  if (rpe >= 6) return "text-amber-500"
  return "text-emerald-500"
}

function severityColor(s: number | null) {
  if (s == null) return "text-muted-foreground"
  if (s >= 7) return "text-red-500"
  if (s >= 4) return "text-amber-500"
  return "text-emerald-500"
}

function ratingStars(n: number | null, max = 5) {
  if (n == null) return "—"
  return "★".repeat(n) + "☆".repeat(Math.max(0, max - n))
}

// ─── main component ───────────────────────────────────────────────────────────

export function AthleteFeedbackPanel({ athletes, summaries, painReports }: Props) {
  const [query, setQuery] = useState("")
  const [expandedAthlete, setExpandedAthlete] = useState<string | null>(null)

  const athleteIds = [...new Set([
    ...summaries.map((s) => s.athlete_id),
    ...painReports.map((p) => p.athlete_id),
  ])]

  const filtered = athleteIds.filter((id) => {
    if (!query.trim()) return true
    const athlete = athletes.find((a) => a.id === id)
    const name = athlete?.profiles?.full_name ?? athlete?.full_name ?? ""
    return name.toLowerCase().includes(query.trim().toLowerCase())
  })

  if (!athleteIds.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session feedback</CardTitle>
          <p className="text-sm text-muted-foreground">
            Athlete session summaries and pain reports will appear here after sessions are completed.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No feedback submitted yet.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Session feedback</h2>
          <p className="text-sm text-muted-foreground">
            {summaries.length} session {summaries.length === 1 ? "summary" : "summaries"} ·{" "}
            {painReports.length} pain {painReports.length === 1 ? "report" : "reports"}
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search athletes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.map((athleteId) => {
        const athlete = athletes.find((a) => a.id === athleteId)
        const name = athlete?.profiles?.full_name ?? athlete?.full_name ?? "Unknown athlete"
        const athleteSummaries = summaries.filter((s) => s.athlete_id === athleteId)
          .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
        const athletePain = painReports.filter((p) => p.athlete_id === athleteId)
          .sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime())
        const isExpanded = expandedAthlete === athleteId
        const hasPain = athletePain.length > 0
        const avgRpe = athleteSummaries.length
          ? Math.round(athleteSummaries.reduce((sum, s) => sum + (s.rpe ?? 0), 0) / athleteSummaries.length * 10) / 10
          : null
        const avgSoreness = athleteSummaries.filter((s) => s.soreness_level != null).length
          ? Math.round(athleteSummaries.reduce((sum, s) => sum + (s.soreness_level ?? 0), 0) / athleteSummaries.filter((s) => s.soreness_level != null).length * 10) / 10
          : null

        return (
          <Card key={athleteId} className={hasPain ? "border-red-500/30" : ""}>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setExpandedAthlete(isExpanded ? null : athleteId)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CardTitle className="text-base">{name}</CardTitle>
                  {hasPain && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="size-3" />
                      {athletePain.length} pain {athletePain.length === 1 ? "report" : "reports"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {athleteSummaries.length} {athleteSummaries.length === 1 ? "session" : "sessions"}
                    </span>
                    {avgRpe != null && (
                      <span className={`font-semibold tabular-nums ${rpeColor(avgRpe)}`}>
                        RPE {avgRpe}
                      </span>
                    )}
                    {avgSoreness != null && (
                      <span className="text-muted-foreground text-xs">
                        Soreness {avgSoreness}/5
                      </span>
                    )}
                  </div>
                  {isExpanded
                    ? <ChevronUp className="size-4 text-muted-foreground" />
                    : <ChevronDown className="size-4 text-muted-foreground" />
                  }
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="flex flex-col gap-6 pt-0">

                {/* ── Pain reports ── */}
                {athletePain.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-red-600">
                      <AlertTriangle className="size-4" /> Pain reports
                    </p>
                    <div className="flex flex-col gap-2">
                      {athletePain.map((report) => (
                        <div key={report.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{report.exercise_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {report.session_title} · {report.session_date}
                              </p>
                            </div>
                            {report.pain_severity != null && (
                              <span className={`text-sm font-bold tabular-nums ${severityColor(report.pain_severity)}`}>
                                {report.pain_severity}/10
                              </span>
                            )}
                          </div>
                          {report.pain_location && (
                            <p className="mt-1 text-xs">
                              <span className="text-muted-foreground">Location: </span>
                              {report.pain_location}
                            </p>
                          )}
                          {report.pain_notes && (
                            <p className="mt-1 text-xs text-muted-foreground italic">"{report.pain_notes}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Session summaries ── */}
                {athleteSummaries.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Activity className="size-4" /> Session summaries
                    </p>
                    <div className="flex flex-col gap-3">
                      {athleteSummaries.map((summary) => (
                        <div key={summary.id} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div>
                              <p className="text-sm font-medium">{summary.session_title}</p>
                              <p className="text-xs text-muted-foreground">{summary.session_date}</p>
                            </div>
                            {summary.rpe != null && (
                              <span className={`text-sm font-bold tabular-nums ${rpeColor(summary.rpe)}`}>
                                RPE {summary.rpe}/10
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                            <div className="flex items-center gap-1">
                              <Zap className="size-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Overall</span>
                              <span className="ml-auto font-medium">{ratingStars(summary.overall_rating)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <HeartPulse className="size-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Soreness</span>
                              <span className="ml-auto font-medium">{summary.soreness_level ?? "—"}/5</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Smile className="size-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Sleep</span>
                              <span className="ml-auto font-medium">{summary.sleep_quality ?? "—"}/5</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="size-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Symptoms</span>
                              <span className="ml-auto font-medium">
                                {summary.symptoms?.filter((s) => s !== "none").length
                                  ? summary.symptoms?.filter((s) => s !== "none").join(", ")
                                  : "None"}
                              </span>
                            </div>
                          </div>
                          {summary.feedback_text && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs">
                              <MessageSquare className="size-3 mt-0.5 shrink-0 text-muted-foreground" />
                              <p className="text-muted-foreground italic">"{summary.feedback_text}"</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {athleteSummaries.length === 0 && athletePain.length === 0 && (
                  <p className="text-sm text-muted-foreground">No feedback recorded yet.</p>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
