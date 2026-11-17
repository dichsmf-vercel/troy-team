"use server"

import { readFile } from "node:fs/promises"
import path from "node:path"
import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAthleteAuthUser, deleteAthleteCompletely } from "@/lib/admin/athlete-accounts"
import { parseCsvObjects, parseCsvRows } from "@/lib/admin/csv"
import { nameKey, validateImportRows } from "@/lib/admin/athlete-import-validation"
import { getT } from "@/lib/i18n/get-language"
import type { ParsedAthleteRow } from "@/lib/excel-import"
import { clubKey } from "@/lib/import-dictionary"
import type { TFunction } from "@/lib/i18n/translate"

const RULES_PROGRAM_NAME = "Coach Ahmed Rules Engine"
const MAX_CSV_ATHLETES = 500

// ─── Coach Ahmed rules CSV ────────────────────────────────────────────────────

export async function importCoachAhmedRulesFromCsv(formData: FormData) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can import rules."))
  if (!auth.ok) return { error: auth.error }

  const service = createAdminClient()
  let { data: program } = await service.from("programs").select("id").eq("name_en", RULES_PROGRAM_NAME).maybeSingle()
  if (!program) {
    const created = await service
      .from("programs")
      .insert({
        name_en: RULES_PROGRAM_NAME,
        name_ar: "محرك قواعد كوتش أحمد",
        description_en: "Authoritative Coach Ahmed CSV rules.",
        status: "published",
      })
      .select("id")
      .single()
    if (created.error) return { error: created.error.message }
    program = created.data
  }
  const programId = program!.id as string

  const uploaded = formData.get("file")
  const csv =
    uploaded instanceof File && uploaded.size
      ? await uploaded.text()
      : await readFile(path.join(process.cwd(), "public/CoachAhmedRules.csv"), "utf8")

  const rows = parseCsvRows(csv)
    .slice(1)
    .map((cells, index) => {
      const [ruleId, metric, operator, threshold, action, exerciseId] = cells.map((cell) => cell.trim())
      return {
        program_id: programId,
        name: ruleId || `CSV-${index + 1}`,
        rule_text: [ruleId, metric, operator, threshold, action, exerciseId].join("\t"),
        rule_type: "coach_ahmed_csv",
        condition_json: { metric, operator, threshold },
        action_json: { action, exercise_id: exerciseId },
        priority: index + 1,
        is_active: true,
      }
    })
  if (!rows.length) return { error: t("The CSV has no rules.") }

  // Replace the old rule set, but restore it if the new one cannot be saved.
  const { data: previous, error: loadError } = await service.from("program_rules").select("*").eq("rule_type", "coach_ahmed_csv")
  if (loadError) return { error: loadError.message }

  const { error: clearError } = await service.from("program_rules").delete().eq("rule_type", "coach_ahmed_csv")
  if (clearError) return { error: clearError.message }

  const { error } = await service.from("program_rules").insert(rows)
  if (error) {
    if (previous?.length) await service.from("program_rules").insert(previous)
    return { error: error.message }
  }

  revalidatePath("/admin")
  return { error: null, imported: rows.length }
}

// ─── Athletes: CSV (email based) ──────────────────────────────────────────────

async function listAllAuthEmails(service: SupabaseClient): Promise<Map<string, string>> {
  const emails = new Map<string, string>()
  const perPage = 1000
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error || !data) break
    for (const user of data.users) if (user.email) emails.set(user.email.toLowerCase(), user.id)
    if (data.users.length < perPage) break
  }
  return emails
}

export async function importAthletesCsv(formData: FormData) {
  const t = await getT()
  const auth = await requireAdmin(t("Only admins can import athletes."))
  if (!auth.ok) return { error: auth.error }

  const file = formData.get("file")
  if (!(file instanceof File) || !file.size) return { error: t("Choose an athletes CSV file.") }
  const rows = parseCsvObjects(await file.text())
  if (!rows.length) return { error: t("The CSV has no athlete rows.") }
  if (rows.length > MAX_CSV_ATHLETES) return { error: t("The CSV has more than {MAX_CSV_ATHLETES} rows. Split it into smaller files.", { MAX_CSV_ATHLETES }) }

  const service = createAdminClient()
  const emailToId = await listAllAuthEmails(service)
  const positive = (row: Record<string, string>, key: string) => {
    const value = Number(row[key])
    return Number.isFinite(value) && value > 0 ? value : null
  }

  let imported = 0
  for (const [index, row] of rows.entries()) {
    const email = (row.email || "").toLowerCase()
    const fullName = row.full_name || ""
    if (!email || !fullName) return { error: t("Row {row} requires full_name and email.", { row: index + 2 }), imported }

    let athleteId = emailToId.get(email)
    if (!athleteId) {
      const created = await service.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name: fullName, role: "athlete" },
      })
      if (created.error || !created.data.user) return { error: created.error?.message || t("Could not create {email}.", { email }), imported }
      athleteId = created.data.user.id
      emailToId.set(email, athleteId)
    }

    const { error: profileError } = await service.from("profiles").upsert({ id: athleteId, full_name: fullName, role: "athlete" })
    if (profileError) return { error: profileError.message, imported }

    const { error: athleteError } = await service.from("athletes").upsert({
      id: athleteId,
      phone: row.phone || null,
      height_cm: positive(row, "height_cm"),
      weight_kg: positive(row, "weight_kg"),
      injury_notes: row.coach_notes || null,
      assessment_status: "draft",
    })
    if (athleteError) return { error: athleteError.message, imported }
    imported++
  }

  revalidatePath("/admin")
  return { error: null, imported }
}

// ─── Athletes: Excel roster (Troy ID based) ───────────────────────────────────

export type ImportCredential = { name: string; troyId: string; temporaryPassword: string }
export type ImportSkipped = { rowNumber: number; name: string; reason: string }
export type ExcelImportResult = {
  error: string | null
  imported: number
  credentials: ImportCredential[]
  skipped: ImportSkipped[]
}

/** Loads every row of a table in 1000-row pages (PostgREST caps a single response at 1000). */
async function fetchAllRows<T>(
  service: SupabaseClient,
  table: string,
  columns: string,
  eq?: { column: string; value: string },
): Promise<{ data: T[]; error: string | null }> {
  const rows: T[] = []
  const pageSize = 1000
  for (let from = 0; from < 50_000; from += pageSize) {
    const base = service.from(table).select(columns)
    const { data, error } = await (eq ? base.eq(eq.column, eq.value) : base).range(from, from + pageSize - 1)
    if (error) return { data: rows, error: error.message }
    rows.push(...((data ?? []) as T[]))
    if ((data?.length ?? 0) < pageSize) break
  }
  return { data: rows, error: null }
}

export async function importAthletesFromExcel(input: ParsedAthleteRow[]): Promise<ExcelImportResult> {
  const t = await getT()
  const result: ExcelImportResult = { error: null, imported: 0, credentials: [], skipped: [] }
  const stop = (error: string): ExcelImportResult => ({ ...result, error })

  const auth = await requireAdmin(t("Only admins can import athletes."))
  if (!auth.ok) return stop(auth.error)

  const validated = validateImportRows(input, t)
  if (!validated.ok) return stop(validated.error)

  const service = createAdminClient()

  // Existing athletes → skip duplicates so re-uploading a file never doubles the roster.
  const profiles = await fetchAllRows<{ id: string; full_name: string | null; full_name_ar: string | null }>(service, "profiles", "id, full_name, full_name_ar", { column: "role", value: "athlete" })
  const athletes = await fetchAllRows<{ id: string; birth_year: number | null }>(service, "athletes", "id, birth_year")
  if (profiles.error || athletes.error) return stop(t("Could not check existing athletes: {error}", { error: profiles.error ?? athletes.error }))
  const birthYearById = new Map(athletes.data.map((athlete) => [athlete.id, athlete.birth_year]))
  const seen = new Map<string, (number | null)[]>()
  const remember = (names: (string | null | undefined)[], birthYear: number | null) => {
    for (const name of names) {
      const key = nameKey(name ?? "")
      if (key) seen.set(key, [...(seen.get(key) ?? []), birthYear])
    }
  }
  for (const profile of profiles.data) remember([profile.full_name, profile.full_name_ar], birthYearById.get(profile.id) ?? null)
  // The same player may be stored in English (transliterated) or Arabic, so every spelling is checked.
  const isDuplicate = (names: (string | null | undefined)[], birthYear: number | null) =>
    names.some((name) => (seen.get(nameKey(name ?? "")) ?? []).some((existing) => existing == null || birthYear == null || existing === birthYear))

  const { data: existingTeams, error: teamsError } = await service.from("teams").select("id,name_en,name_ar")
  if (teamsError) return stop(t("Could not load teams: {message}", { message: teamsError.message }))
  const teamIdByName = new Map<string, string>()
  for (const team of existingTeams ?? []) {
    for (const name of [team.name_en, team.name_ar]) if (name?.trim()) teamIdByName.set(clubKey(name), team.id)
  }

  for (const row of validated.rows) {
    const fullName = row.fullName.trim()
    const birthYear = row.birthYear ?? null

    if (isDuplicate([row.fullName, row.fullNameAr], birthYear)) {
      result.skipped.push({ rowNumber: row.rowNumber, name: fullName, reason: "An athlete with this name already exists." })
      continue
    }

    // Club → team (created on first use).
    let teamId: string | null = null
    const clubName = row.clubName?.trim()
    if (clubName && clubName.toLocaleLowerCase() !== "not set") {
      // "الطيران", "طيران " and "Al Tayaran" are the same club.
      const key = clubKey(row.clubNameAr ?? clubName)
      teamId = teamIdByName.get(key) ?? null
      if (!teamId) {
        const { data: team, error } = await service
          .from("teams")
          .insert({ name_en: clubName, name_ar: row.clubNameAr ?? clubName, color_hex: "#2563eb", created_by: auth.ctx.user.id })
          .select("id")
          .single()
        if (error || !team) return stop(t("Row {row}: could not create team \"{club}\": {error}", { row: row.rowNumber, club: clubName, error: error?.message ?? t("no team returned") }))
        teamId = team.id
        teamIdByName.set(key, team.id)
      }
    }

    const created = await createAthleteAuthUser(service, fullName)
    if (!created.ok) return stop(t("Row {rowNumber}: {error}", { rowNumber: row.rowNumber, error: created.error }))
    const athleteId = created.id

    const rollback = async (message: string) => {
      await deleteAthleteCompletely(service, athleteId)
      return stop(t("Row {rowNumber}: {message}", { rowNumber: row.rowNumber, message }))
    }

    const { error: profileError } = await service.from("profiles").upsert({
      id: athleteId,
      full_name: fullName,
      full_name_ar: row.fullNameAr ?? (/[\u0600-\u06ff]/.test(fullName) ? fullName : null),
      role: "athlete",
      troy_id: created.troyId,
      password_change_required: true,
    })
    if (profileError) return rollback(t("Profile save failed: {message}", { message: profileError.message }))

    const { error: athleteError } = await service.from("athletes").upsert({
      id: athleteId,
      sport: row.sport || "Not Set",
      position: row.position || "Not Set",
      birth_year: birthYear,
      free_training_days: [0, 1, 2, 3, 4, 5, 6],
      show_exercise_recap: true,
      goals: "Standard Program",
      assessment_status: "draft",
    })
    if (athleteError) return rollback(t("Athlete profile save failed: {message}", { message: athleteError.message }))

    if (teamId) {
      const { error } = await service.from("athlete_teams").insert({ athlete_id: athleteId, team_id: teamId })
      if (error) return rollback(t("Team assignment failed: {message}", { message: error.message }))
    }

    const saved = await saveImportedAssessment(service, athleteId, row, t)
    if (saved.error) return rollback(saved.error)

    result.credentials.push({ name: fullName, troyId: created.troyId, temporaryPassword: created.temporaryPassword })
    result.imported++
    remember([row.fullName, row.fullNameAr], birthYear)
  }

  revalidatePath("/admin")
  return result
}

async function saveImportedAssessment(service: SupabaseClient, athleteId: string, row: ParsedAthleteRow, t: TFunction): Promise<{ error: string | null }> {
  const fms = [row.deepSquat, row.hurdleStep, row.inlineLunge, row.shoulderMobility, row.activeStraightLegRaise, row.trunkStability, row.rotaryStability]
  const fmsTotal = fms.every((score) => typeof score === "number") ? fms.reduce<number>((total, score) => total + (score ?? 0), 0) : null

  const notes = ["Imported from Excel roster", row.assessmentDate ? `Assessment date: ${row.assessmentDate}` : null, row.rawNotes]
    .filter(Boolean)
    .join("\n")
  const submittedAt =
    row.assessmentDate && /^\d{4}-\d{2}-\d{2}$/.test(row.assessmentDate) ? `${row.assessmentDate}T12:00:00.000Z` : new Date().toISOString()

  const { data: assessment, error } = await service
    .from("athlete_assessments")
    .insert({ athlete_id: athleteId, status: "draft", version: 1, coach_notes: notes, injury_flags: [], goals: [], submitted_at: submittedAt })
    .select("id")
    .single()
  if (error || !assessment) return { error: t("Assessment save failed: {error}", { error: error?.message ?? t("no assessment returned") }) }

  const values: [string, number | null | undefined][] = [
    ["deep_squat", row.deepSquat],
    ["hurdle_step", row.hurdleStep],
    ["inline_lunge", row.inlineLunge],
    ["shoulder_mobility", row.shoulderMobility],
    ["active_straight_leg_raise", row.activeStraightLegRaise],
    ["trunk_stability", row.trunkStability],
    ["rotary_stability", row.rotaryStability],
    ["fms_total", fmsTotal],
    ["v_jump_cm", row.verticalJumpCm],
    ["horizontal_jump_cm", row.horizontalJumpCm],
    ["sprint_20m_seconds", row.sprint20mSec],
    ["t_test_seconds", row.tTestSec],
    ["agility_505_r_seconds", row.agility505RSec],
    ["agility_505_l_seconds", row.agility505LSec],
    ["push_ups", row.pushUps],
    ["pull_ups", row.pullUps],
    ["plank_seconds", row.plankSec],
    ["beep_test_level", row.beepTestLevel],
    ["row_machine_result", row.rowMachineResult],
    ["row_machine_watts", row.rowMachineWatts],
  ]
  const answers = values
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .map(([question_key, value]) => ({ assessment_id: assessment.id, question_key, answer_json: { value } }))

  if (answers.length) {
    const { error: answersError } = await service.from("athlete_assessment_answers").insert(answers)
    if (answersError) return { error: t("Assessment measurements save failed: {message}", { message: answersError.message }) }
  }
  return { error: null }
}
