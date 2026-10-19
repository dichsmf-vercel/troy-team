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
    console.groupCollapsed("[session-debug] 📋 Dashboard — assigned session visibility")
    console.table({
      athleteId,
      teamCount: teamIds.length,
      directAssignments: directPosts.length,
      teamAssignments: teamPosts.length,
      totalUnique: directPosts.length + teamPosts.length,
      directQueryError: errors.direct ?? "none",
      teamQueryError: errors.team ?? "none",
      exerciseQueryError: errors.exercises ?? "none",
      attendanceQueryError: errors.attendance ?? "none",
    })
    if (directPosts.length) {
      console.log("[session-debug] Direct assignments:", directPosts.map((p) => ({ id: p.id, title: p.title })))
    }
    if (teamPosts.length) {
      console.log("[session-debug] Team assignments:", teamPosts.map((p) => ({ id: p.id, title: p.title })))
    }
    console.log("[session-debug] Exercise counts by session post:", exerciseCounts)
    const zeroPosts = [...directPosts, ...teamPosts].filter((p) => !exerciseCounts[p.id])
    if (zeroPosts.length) {
      console.error("[session-debug] ❌ These sessions have 0 exercises — athletes cannot start them:", zeroPosts.map((p) => p.id))
    }
    if (!directPosts.length && !teamPosts.length) {
      console.warn("[session-debug] ⚠️ No assigned sessions reached the browser — check RLS policies and Supabase query errors above")
    }
    if (errors.direct) console.error("[session-debug] ❌ Direct query error:", errors.direct)
    if (errors.team) console.error("[session-debug] ❌ Team query error:", errors.team)
    if (errors.exercises) console.error("[session-debug] ❌ Exercise query error:", errors.exercises)
    if (errors.attendance) console.error("[session-debug] ❌ Attendance query error:", errors.attendance)
    console.groupEnd()
  }, [athleteId, directPosts, teamPosts, teamIds, exerciseCounts, errors])

  return null
}
