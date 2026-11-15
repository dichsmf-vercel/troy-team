export type RagStatus = {
  color: "red" | "amber" | "green"
  label: string
  badgeClass: string
}

export function getPerformanceRag(
  key: string,
  rawVal: number | string | null | undefined
): RagStatus | null {
  if (rawVal === "" || rawVal == null) return null
  const val = Number(rawVal)
  if (!Number.isFinite(val)) return null

  switch (key) {
    case "v_jump_cm":
      if (val < 30) return { color: "red", label: "Low (<30)", badgeClass: "bg-red-500/10 text-red-600 border-red-200" }
      if (val <= 45) return { color: "amber", label: "Moderate (30–45)", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200" }
      return { color: "green", label: "Good (>45)", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }

    case "sprint_30m_seconds":
      if (val > 5.0) return { color: "red", label: "Slow (>5.0s)", badgeClass: "bg-red-500/10 text-red-600 border-red-200" }
      if (val >= 4.5) return { color: "amber", label: "Average (4.5–5.0s)", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200" }
      return { color: "green", label: "Fast (<4.5s)", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }

    case "t_test_seconds":
      if (val > 11.5) return { color: "red", label: "Slow (>11.5s)", badgeClass: "bg-red-500/10 text-red-600 border-red-200" }
      if (val >= 10.5) return { color: "amber", label: "Average (10.5–11.5s)", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200" }
      return { color: "green", label: "Fast (<10.5s)", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }

    case "beep_test_level":
      if (val < 6) return { color: "red", label: "Low (<6)", badgeClass: "bg-red-500/10 text-red-600 border-red-200" }
      if (val <= 10) return { color: "amber", label: "Average (6–10)", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200" }
      return { color: "green", label: "High (>10)", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }

    case "beep_test_vo2_max":
      if (val < 40) return { color: "red", label: "Low (<40)", badgeClass: "bg-red-500/10 text-red-600 border-red-200" }
      if (val <= 50) return { color: "amber", label: "Average (40–50)", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200" }
      return { color: "green", label: "Good (>50)", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }

    case "star_balance":
      if (val < 70) return { color: "red", label: "Needs work (<70)", badgeClass: "bg-red-500/10 text-red-600 border-red-200" }
      if (val <= 85) return { color: "amber", label: "Good (70–85)", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200" }
      return { color: "green", label: "Excellent (>85)", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }

    case "agility_rshaqah_seconds":
      if (val > 12) return { color: "red", label: "Slow (>12s)", badgeClass: "bg-red-500/10 text-red-600 border-red-200" }
      if (val >= 10) return { color: "amber", label: "Average (10–12s)", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200" }
      return { color: "green", label: "Fast (<10s)", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }

    case "fms_total":
      if (val < 14) return { color: "red", label: "High risk (<14)", badgeClass: "bg-red-500/10 text-red-600 border-red-200" }
      if (val <= 17) return { color: "amber", label: "Moderate (14–17)", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200" }
      return { color: "green", label: "Optimal (≥18)", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }

    default:
      return null
  }
}
