import type { SupabaseClient } from "@supabase/supabase-js"
import { generateTroyId, troyIdToEmail } from "@/lib/troy-id"

/** Shared helpers for creating and removing athlete accounts (service-role client required). */

export function generateTemporaryPassword(): string {
  return `Troy-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}!`
}

export type NewAthleteAuth =
  | { ok: true; id: string; troyId: string; temporaryPassword: string }
  | { ok: false; error: string }

/** Creates the Supabase auth user for an athlete with a unique Troy ID. */
export async function createAthleteAuthUser(service: SupabaseClient, fullName: string): Promise<NewAthleteAuth> {
  let lastError = "Could not generate a unique Troy ID."

  for (let attempt = 0; attempt < 6; attempt++) {
    const troyId = generateTroyId()
    const { data: existing, error: lookupError } = await service.from("profiles").select("id").eq("troy_id", troyId).maybeSingle()
    if (lookupError) return { ok: false, error: `Could not verify Troy ID: ${lookupError.message}` }
    if (existing) continue

    const temporaryPassword = generateTemporaryPassword()
    const { data, error } = await service.auth.admin.createUser({
      email: troyIdToEmail(troyId),
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "athlete", troy_id: troyId },
    })
    if (error || !data.user) {
      lastError = error?.message ?? "Could not create athlete account."
      if (lastError.toLowerCase().includes("already")) continue
      return { ok: false, error: lastError }
    }
    return { ok: true, id: data.user.id, troyId, temporaryPassword }
  }

  return { ok: false, error: lastError }
}

type PgError = { code?: string; message?: string } | null

function isMissingFunction(error: PgError): boolean {
  return !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? ""))
}

async function fetchPaths(service: SupabaseClient, table: string, filterColumn: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const { data } = await service.from(table).select("storage_path").in(filterColumn, ids)
  return (data ?? []).map((row: { storage_path: string }) => row.storage_path).filter(Boolean)
}

/**
 * Deletes an athlete and everything they own.
 *
 * DB rows are removed by the `delete_athlete_cascade` SQL function inside ONE transaction, so a
 * failure leaves the athlete fully intact. Storage files and the auth user are removed only after
 * the database succeeded. If the migration has not been applied yet, falls back to the legacy
 * sequential deletes (remove this fallback once `202611180001_delete_athlete_cascade.sql` is live).
 */
export async function deleteAthleteCompletely(service: SupabaseClient, athleteId: string): Promise<{ error: string | null }> {
  // 1. Collect storage paths BEFORE the rows disappear.
  const { data: sessionAthletes } = await service.from("session_athletes").select("id").eq("athlete_id", athleteId)
  const sessionAthleteIds = (sessionAthletes ?? []).map((row: { id: string }) => row.id)

  const [sessionSelfiePaths, sessionExercisePaths, programSelfiePaths] = await Promise.all([
    fetchPaths(service, "session_selfies", "session_athlete_id", sessionAthleteIds),
    fetchPaths(service, "session_exercise_selfies", "athlete_id", [athleteId]),
    fetchPaths(service, "program_exercise_selfies", "athlete_id", [athleteId]),
  ])

  // 2. Database rows, atomically.
  const { error: rpcError } = await service.rpc("delete_athlete_cascade", { p_athlete_id: athleteId })
  if (rpcError) {
    if (!isMissingFunction(rpcError)) return { error: `Could not delete athlete data: ${rpcError.message}` }
    const legacy = await deleteRowsSequentially(service, athleteId, sessionAthleteIds)
    if (legacy.error) return legacy
  }

  // 3. Storage + auth user (best effort for files; auth failure is reported).
  const sessionFiles = [...sessionSelfiePaths, ...sessionExercisePaths]
  if (sessionFiles.length) await service.storage.from("session-selfies").remove(sessionFiles)
  if (programSelfiePaths.length) await service.storage.from("exercise-selfies").remove(programSelfiePaths)

  const { error: authError } = await service.auth.admin.deleteUser(athleteId)
  if (authError) return { error: `Athlete data was removed, but the login could not be deleted: ${authError.message}` }
  return { error: null }
}

async function deleteRowsSequentially(service: SupabaseClient, athleteId: string, sessionAthleteIds: string[]): Promise<{ error: string | null }> {
  const { data: assessments } = await service.from("athlete_assessments").select("id").eq("athlete_id", athleteId)
  const assessmentIds = (assessments ?? []).map((row: { id: string }) => row.id)
  if (assessmentIds.length) {
    const { error } = await service.from("athlete_assessment_answers").delete().in("assessment_id", assessmentIds)
    if (error) return { error: `Could not delete assessment answers: ${error.message}` }
  }
  if (sessionAthleteIds.length) {
    const { error } = await service.from("session_selfies").delete().in("session_athlete_id", sessionAthleteIds)
    if (error) return { error: `Could not delete selfies: ${error.message}` }
  }
  await service.from("session_exercise_selfies").delete().eq("athlete_id", athleteId)

  const tables: [string, string][] = [
    ["session_athletes", "athlete_id"],
    ["session_posts", "athlete_id"],
    ["athlete_programs", "athlete_id"],
    ["athlete_assessments", "athlete_id"],
    ["inbody_records", "athlete_id"],
    ["measurements", "athlete_id"],
    ["athlete_teams", "athlete_id"],
    ["athletes", "id"],
    ["profiles", "id"],
  ]
  for (const [table, column] of tables) {
    const { error } = await service.from(table).delete().eq(column, athleteId)
    if (error) return { error: `Could not delete ${table}: ${error.message}` }
  }
  return { error: null }
}
