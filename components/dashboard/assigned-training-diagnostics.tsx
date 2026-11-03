"use client"

// Diagnostics component — logging disabled for production
export function AssignedTrainingDiagnostics(_props: {
  athleteId: string
  directPosts: Array<{ id: string; title: string | null }>
  teamPosts: Array<{ id: string; title: string | null }>
  teamIds: string[]
  exerciseCounts: Record<string, number>
  errors: { direct: string | null; team: string | null; exercises: string | null; attendance: string | null }
}) {
  return null
}
