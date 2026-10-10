"use client"

import { useEffect } from "react"

type Props = {
  athleteId: string
  directPosts: Array<{ id: string; title: string | null }>
  teamPosts: Array<{ id: string; title: string | null }>
  teamIds: string[]
  exerciseCounts: Record<string, number>
  errors: { direct: string | null; team: string | null; exercises: string | null; attendance: string | null }
}

export function AssignedTrainingDiagnostics({ athleteId, directPosts, teamPosts, teamIds, exerciseCounts, errors }: Props) {
  useEffect(() => {
    const payload = { athleteId, teamIds, directPosts, teamPosts, exerciseCounts, errors, timestamp: new Date().toISOString() }
    console.groupCollapsed("[assigned-session-debug] Athlete assignment visibility")
    console.log(payload)
    console.table({
      "direct assignments returned": directPosts.length,
      "team assignments returned": teamPosts.length,
      "exercise rows by session": JSON.stringify(exerciseCounts),
      "direct query error": errors.direct ?? "none",
      "team query error": errors.team ?? "none",
      "exercise query error": errors.exercises ?? "none",
      "attendance query error": errors.attendance ?? "none",
    })
    if (!directPosts.length && !teamPosts.length) console.warn("[assigned-session-debug] No assigned sessions reached the browser. Check direct/team query errors and Supabase RLS policies.")
    console.groupEnd()
  }, [athleteId, directPosts, teamPosts, teamIds, exerciseCounts, errors])

  return null
}
