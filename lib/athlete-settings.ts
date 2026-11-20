import type { SupabaseClient } from "@supabase/supabase-js"

export type AthleteToggles = { selfieRequired: boolean; showUpcomingExercises: boolean; showExerciseRecap: boolean }

/**
 * Coach toggles for one athlete. Uses select("*") so it keeps working before migration
 * 202611200001 adds selfie_required / show_upcoming_exercises (defaults: off, off, recap on).
 */
export async function loadAthleteToggles(supabase: SupabaseClient, athleteId: string): Promise<AthleteToggles> {
  const { data } = await supabase.from("athletes").select("*").eq("id", athleteId).maybeSingle()
  const row = (data ?? {}) as Record<string, unknown>
  return {
    selfieRequired: row.selfie_required === true,
    showUpcomingExercises: row.show_upcoming_exercises === true,
    showExerciseRecap: row.show_exercise_recap !== false,
  }
}
