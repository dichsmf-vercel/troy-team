"use client"

import Link from "next/link"
import { useLanguage } from "@/components/providers/language-provider"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { safeTime } from "@/lib/formatters"

export type SessionCardData = {
  sessionAthleteId: string
  sessionPostId: string
  titleEn: string
  titleAr: string
  sessionDate: string
  period: string | null
  exerciseCount: number
  teamNameEn: string
  teamNameAr: string
  teamImageUrl: string | null
  colorHex: string
  isNationalTeam: boolean
  hasSummary: boolean
  attendedAt: string | null
}

export function SessionCard({ session }: { session: SessionCardData }) {
  const { language, dict, dir } = useLanguage()
  const title = language === "ar" ? session.titleAr : session.titleEn
  const teamName = language === "ar" ? session.teamNameAr : session.teamNameEn
  const periodLabel = safeTime(session.period, language === "ar" ? "ar-SA" : "en-US")

  const isComplete = Boolean(session.attendedAt) && session.hasSummary
  const href = isComplete
    ? `/session/${session.sessionPostId}/summary`
    : `/session/${session.sessionPostId}`

  return (
    <Link
      href={href}
      onClick={() => console.log("[assigned-session-debug] Start training clicked", { sessionPostId: session.sessionPostId, sessionAthleteId: session.sessionAthleteId, sessionDate: session.sessionDate, exerciseCount: session.exerciseCount, completed: isComplete, destination: href })}
      dir={dir}
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border p-5 transition-colors",
        session.isNationalTeam
          ? "border-team-national/40 bg-gradient-to-br from-team-national/10 via-card to-card"
          : "border-border bg-card",
      )}
      style={{ borderInlineStartWidth: "4px", borderInlineStartColor: session.colorHex }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide" style={{ color: session.colorHex }}>{session.teamImageUrl ? <img src={session.teamImageUrl} alt="" className="size-6 rounded-full object-contain" /> : null}{teamName}</span>
          <h3 className="text-base font-semibold text-balance">{title}</h3>
        </div>
        {isComplete ? (
          <Badge variant="secondary" className="rounded-md shrink-0 gap-1 bg-emerald-500/15 text-emerald-500"><span aria-hidden="true">✓</span>{dict.dashboard.completed}</Badge>
        ) : <Badge className="shrink-0">Start training</Badge>}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular">{periodLabel}</span>
        <span className="tabular">
          {session.exerciseCount} {dict.dashboard.exercises}
        </span>
      </div>
    </Link>
  )
}
