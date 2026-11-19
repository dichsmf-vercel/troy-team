"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { useLanguage, useLn, useT } from "@/components/providers/language-provider"
import { sportLabel } from "@/lib/i18n/labels"

export type PickableAthlete = {
  id: string
  full_name?: string | null
  sport?: string | null
  free_training_days?: number[] | null
  profiles?: { full_name?: string | null; full_name_ar?: string | null; troy_id?: string | null } | null
}

/** Days the generators start with: the athlete's own available days, or Mon/Wed/Fri when they are free every day. */
export function defaultTrainingDays(athlete: PickableAthlete | undefined): number[] {
  const free = [...new Set((athlete?.free_training_days ?? []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
  if (!free.length || free.length === 7) return [1, 3, 5]
  return free
}

/**
 * Searchable athlete select (by name in either language or Troy ID), sorted by name.
 * With 80+ athletes a plain unsorted select was unusable.
 */
export function AthletePicker({
  id,
  athletes,
  value,
  onChange,
}: {
  id: string
  athletes: PickableAthlete[]
  value: string
  onChange: (athleteId: string) => void
}) {
  const t = useT()
  const ln = useLn()
  const { locale } = useLanguage()
  const [query, setQuery] = useState("")

  const sorted = useMemo(() => {
    const label = (athlete: PickableAthlete) => ln(athlete.profiles?.full_name ?? athlete.full_name ?? "", athlete.profiles?.full_name_ar ?? null) || athlete.id
    return athletes
      .map((athlete) => ({ athlete, label: label(athlete) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [athletes, ln, locale])

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? sorted.filter(({ athlete, label }) =>
        [label, athlete.profiles?.full_name, athlete.profiles?.full_name_ar, athlete.profiles?.troy_id].some((text) => String(text ?? "").toLowerCase().includes(needle)),
      )
    : sorted
  // Keep the current choice selectable even when the search hides it.
  const current = sorted.find((item) => item.athlete.id === value)
  const options = current && !visible.includes(current) ? [current, ...visible] : visible

  return (
    <div className="grid gap-2">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("Search by name or Troy ID")}
        aria-label={t("Search athletes")}
        className="h-9"
      />
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border bg-background px-3 text-sm"
      >
        {options.map(({ athlete, label }) => {
          const sport = sportLabel(t, athlete.sport)
          return (
            <option key={athlete.id} value={athlete.id}>
              {label}
              {sport ? ` · ${sport}` : ""}
              {athlete.profiles?.troy_id ? ` (${athlete.profiles.troy_id})` : ""}
            </option>
          )
        })}
      </select>
      {needle && !visible.length ? <p className="text-xs text-muted-foreground">{t("No athletes match your search.")}</p> : null}
    </div>
  )
}
