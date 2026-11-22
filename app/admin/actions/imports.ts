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
import { matchRow, planAssessment, rowResults, withFmsTotal, type AssessmentPlan, type KnownAthlete, type SavedAssessment } from "@/lib/admin/athlete-import-plan"
import { getT } from "@/lib/i18n/get-language"
import type { ParsedAthleteRow } from "@/lib/excel-import"
import { clubKey } from "@/lib/import-dictionary"
import { fieldValue } from "@/lib/i18n/labels"
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
export type ImportOutcome = {
  rowNumber: number
  name: string
  kind: "new" | "update" | "unchanged" | "skipped"
  /** What changes for an existing athlete, ready to show. */
  changes: string[]
  /** Why a row is skipped, or something the coach should check. */
  note: string | null
}
export type ExcelImportResult = {
  error: string | null
  credentials: ImportCredential[]
  rows: ImportOutcome[]
  /** Athletes already created/updated by this file; pass back with the next batch so a repeated row is not applied twice. */
  handledIds: string[]
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

type ProfileRow = { id: string; full_name: string | null; full_name_ar: string | null }
type AthleteRow = { id: string; birth_year: number | null; sport: string | null; position: string | null }

/**
 * Adds new athletes and updates existing ones from a roster sheet. For an existing athlete only filled
 * cells count: sport, position, missing birth year / Arabic name, an extra club and new test results.
 * Passwords, settings, programs and clubs already assigned are never touched.
 * `dryRun` saves nothing and only reports what would happen (the preview in the import dialog).
 */
export async function importAthletesFromExcel(
  input: ParsedAthleteRow[],
  options: { dryRun?: boolean; handledIds?: string[] } = {},
): Promise<ExcelImportResult> {
  const t = await getT()
  const result: ExcelImportResult = { error: null, credentials: [], rows: [], handledIds: [] }
  const stop = (error: string): ExcelImportResult => ({ ...result, error })

  const auth = await requireAdmin(t("Only admins can import athletes."))
  if (!auth.ok) return stop(auth.error)

  const validated = validateImportRows(input, t)
  if (!validated.ok) return stop(validated.error)
  const dryRun = options?.dryRun === true
  const handled = new Set((Array.isArray(options?.handledIds) ? options.handledIds : []).filter((id) => typeof id === "string").slice(0, 1000))

  const service = createAdminClient()

  const profiles = await fetchAllRows<ProfileRow>(service, "profiles", "id, full_name, full_name_ar", { column: "role", value: "athlete" })
  const athletes = await fetchAllRows<AthleteRow>(service, "athletes", "id, birth_year, sport, position")
  const memberships = await fetchAllRows<{ athlete_id: string; team_id: string }>(service, "athlete_teams", "athlete_id, team_id")
  const loadError = profiles.error ?? athletes.error ?? memberships.error
  if (loadError) return stop(t("Could not check existing athletes: {error}", { error: loadError }))

  const athleteById = new Map(athletes.data.map((athlete) => [athlete.id, athlete]))
  const profileById = new Map(profiles.data.map((profile) => [profile.id, profile]))
  const teamsByAthlete = new Map<string, Set<string>>()
  for (const row of memberships.data) teamsByAthlete.set(row.athlete_id, (teamsByAthlete.get(row.athlete_id) ?? new Set()).add(row.team_id))
  const knownByName = new Map<string, KnownAthlete[]>()
  const remember = (names: (string | null | undefined)[], known: KnownAthlete) => {
    for (const key of new Set(names.map((name) => nameKey(name ?? "")).filter(Boolean))) knownByName.set(key, [...(knownByName.get(key) ?? []), known])
  }
  for (const profile of profiles.data) {
    remember([profile.full_name, profile.full_name_ar], { id: profile.id, birthYear: athleteById.get(profile.id)?.birth_year ?? null, teamIds: teamsByAthlete.get(profile.id) ?? new Set() })
  }

  const { data: existingTeams, error: teamsError } = await service.from("teams").select("id,name_en,name_ar")
  if (teamsError) return stop(t("Could not load teams: {message}", { message: teamsError.message }))
  const teamIdByName = new Map<string, string>()
  for (const team of existingTeams ?? []) {
    for (const name of [team.name_en, team.name_ar]) if (name?.trim()) teamIdByName.set(clubKey(name), team.id)
  }

  for (const row of validated.rows) {
    const fullName = row.fullName.trim()
    const birthYear = row.birthYear ?? null
    const outcome = (kind: ImportOutcome["kind"], changes: string[] = [], note: string | null = null) =>
      result.rows.push({ rowNumber: row.rowNumber, name: fullName, kind, changes, note })
    const fail = (message: string) => stop(t("Row {rowNumber}: {message}", { rowNumber: row.rowNumber, message }))

    // "الطيران", "طيران " and "Al Tayaran" are the same club.
    const clubName = row.clubName?.trim() && row.clubName.trim().toLocaleLowerCase() !== "not set" ? row.clubName.trim() : null
    const teamKey = clubName ? clubKey(row.clubNameAr ?? clubName) : null
    const knownTeamId = teamKey ? (teamIdByName.get(teamKey) ?? null) : null
    const ensureTeam = async (): Promise<{ id: string | null; error: string | null }> => {
      if (!clubName || !teamKey) return { id: null, error: null }
      const existing = teamIdByName.get(teamKey)
      if (existing) return { id: existing, error: null }
      const { data: team, error } = await service
        .from("teams")
        .insert({ name_en: clubName, name_ar: row.clubNameAr ?? clubName, color_hex: "#2563eb" })
        .select("id")
        .single()
      if (error || !team) return { id: null, error: t("could not create team \"{club}\": {error}", { club: clubName, error: error?.message ?? t("no team returned") }) }
      teamIdByName.set(teamKey, team.id)
      return { id: team.id, error: null }
    }

    const sameName = [row.fullName, row.fullNameAr].flatMap((name) => knownByName.get(nameKey(name ?? "")) ?? [])
    const match = matchRow(sameName, birthYear, knownTeamId)

    if (match.kind === "ambiguous") {
      outcome("skipped", [], t("More than one athlete has this name. Add a birth year or club to the sheet, or edit the profile by hand."))
      continue
    }

    // ── Existing athlete ─────────────────────────────────────────────────────
    if (match.kind === "existing") {
      const athleteId = match.known.id
      if (!athleteId || handled.has(athleteId)) {
        outcome("skipped", [], t("This athlete appears more than once in the file. Only the first row is used."))
        continue
      }
      handled.add(athleteId)
      const athlete = athleteById.get(athleteId)
      const profile = profileById.get(athleteId)
      const changes: string[] = []
      const athleteUpdate: Record<string, string | number> = {}
      const change = (label: string, before: string | number | null | undefined, after: string | number) =>
        changes.push(before == null || before === "" ? `${label}: ${after}` : `${label}: ${before} → ${after}`)

      const sport = fieldValue(row.sport)
      if (sport && sport.toLocaleLowerCase() !== fieldValue(athlete?.sport).toLocaleLowerCase()) {
        athleteUpdate.sport = sport
        change(t("Sport"), fieldValue(athlete?.sport), sport)
      }
      const position = fieldValue(row.position)
      if (position && position.toLocaleLowerCase() !== fieldValue(athlete?.position).toLocaleLowerCase()) {
        athleteUpdate.position = position
        change(t("Position"), fieldValue(athlete?.position), position)
      }
      if (birthYear != null && athlete?.birth_year == null) {
        athleteUpdate.birth_year = birthYear
        change(t("Birth year"), null, birthYear)
      }
      const nameAr = !profile?.full_name_ar?.trim() && row.fullNameAr?.trim() ? row.fullNameAr.trim() : null
      if (nameAr) change(t("Arabic name"), null, nameAr)
      const addClub = !!clubName && !(knownTeamId && match.known.teamIds.has(knownTeamId))
      if (addClub) change(t("Club added"), null, clubName)

      const saved = await loadLatestAssessment(service, athleteId)
      if (saved.error) return fail(saved.error)
      const plan = planAssessment(saved.assessment, row, new Date().toISOString().slice(0, 10))
      let note: string | null = null
      if (plan.action === "insert" || plan.action === "update") changes.push(t.plural(plan.changed.length, "{count} test result", "{count} test results"))
      if (plan.action === "older") note = t("The sheet's test date is older than the saved results, so the saved results are kept.")

      if (!dryRun) {
        if (Object.keys(athleteUpdate).length) {
          const { error } = await service.from("athletes").update(athleteUpdate).eq("id", athleteId)
          if (error) return fail(t("Athlete profile save failed: {message}", { message: error.message }))
        }
        if (nameAr) {
          const { error } = await service.from("profiles").update({ full_name_ar: nameAr }).eq("id", athleteId)
          if (error) return fail(t("Profile save failed: {message}", { message: error.message }))
        }
        if (addClub) {
          const team = await ensureTeam()
          if (team.error) return fail(team.error)
          const { error } = await service.from("athlete_teams").upsert({ athlete_id: athleteId, team_id: team.id }, { onConflict: "athlete_id,team_id", ignoreDuplicates: true })
          if (error) return fail(t("Team assignment failed: {message}", { message: error.message }))
        }
        if (plan.action === "insert" || plan.action === "update") {
          const stored = await saveAssessmentPlan(service, athleteId, row, plan, saved, t)
          if (stored.error) return fail(stored.error)
        }
      }
      outcome(changes.length ? "update" : "unchanged", changes, note)
      continue
    }

    // ── New athlete ──────────────────────────────────────────────────────────
    const newNote = match.sameName ? t("Another athlete has the same name but a different birth year or club. Check that this is a new person.") : null
    if (dryRun) {
      remember([row.fullName, row.fullNameAr], { id: null, birthYear, teamIds: new Set(knownTeamId ? [knownTeamId] : []) })
      outcome("new", [], newNote)
      continue
    }

    const team = await ensureTeam()
    if (team.error) return fail(team.error)
    const created = await createAthleteAuthUser(service, fullName)
    if (!created.ok) return fail(created.error)
    const athleteId = created.id

    const rollback = async (message: string) => {
      await deleteAthleteCompletely(service, athleteId)
      return fail(message)
    }

    const { error: profileError } = await service.from("profiles").upsert({
      id: athleteId,
      full_name: fullName,
      full_name_ar: row.fullNameAr ?? (/[؀-ۿ]/.test(fullName) ? fullName : null),
      role: "athlete",
      troy_id: created.troyId,
      password_change_required: true,
    })
    if (profileError) return rollback(t("Profile save failed: {message}", { message: profileError.message }))

    const { error: athleteError } = await service.from("athletes").upsert({
      id: athleteId,
      sport: fieldValue(row.sport) || null,
      position: fieldValue(row.position) || null,
      birth_year: birthYear,
      free_training_days: [0, 1, 2, 3, 4, 5, 6],
      show_exercise_recap: true,
      goals: "Standard Program",
      assessment_status: "draft",
    })
    if (athleteError) return rollback(t("Athlete profile save failed: {message}", { message: athleteError.message }))

    if (team.id) {
      const { error } = await service.from("athlete_teams").insert({ athlete_id: athleteId, team_id: team.id })
      if (error) return rollback(t("Team assignment failed: {message}", { message: error.message }))
    }

    const stored = await insertAssessment(service, athleteId, row, toAnswers(withFmsTotal(rowResults(row))), t)
    if (stored.error) return rollback(stored.error)

    handled.add(athleteId)
    result.credentials.push({ name: fullName, troyId: created.troyId, temporaryPassword: created.temporaryPassword })
    remember([row.fullName, row.fullNameAr], { id: athleteId, birthYear, teamIds: new Set(team.id ? [team.id] : []) })
    outcome("new", [], newNote)
  }

  result.handledIds = [...handled]
  if (!dryRun) revalidatePath("/admin")
  return result
}

type Answer = { question_key: string; answer_json: unknown }
type LatestAssessment = { error: string | null; id: string | null; answers: Map<string, unknown>; assessment: SavedAssessment | null }

const toAnswers = (results: Record<string, unknown>): Answer[] => Object.entries(results).map(([question_key, value]) => ({ question_key, answer_json: { value } }))

/** The record the admin screens show: newest by submitted_at (same order as app/admin/page.tsx). */
async function loadLatestAssessment(service: SupabaseClient, athleteId: string): Promise<LatestAssessment> {
  const { data, error } = await service
    .from("athlete_assessments")
    .select("id,status,submitted_at,coach_notes,athlete_assessment_answers(question_key,answer_json)")
    .eq("athlete_id", athleteId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { error: error.message, id: null, answers: new Map(), assessment: null }
  if (!data) return { error: null, id: null, answers: new Map(), assessment: null }
  const answers = new Map(((data.athlete_assessment_answers ?? []) as Answer[]).map((answer) => [answer.question_key, answer.answer_json]))
  const results = Object.fromEntries([...answers].map(([key, json]) => [key, (json as { value?: unknown } | null)?.value ?? null]))
  const notes = data.coach_notes ?? ""
  const dateIsImportDay = notes.startsWith("Imported from Excel roster") && !notes.includes("Assessment date:")
  return { error: null, id: data.id, answers, assessment: { date: data.submitted_at, status: data.status, results, dateIsImportDay } }
}

async function saveAssessmentPlan(
  service: SupabaseClient,
  athleteId: string,
  row: ParsedAthleteRow,
  plan: Extract<AssessmentPlan, { action: "insert" | "update" }>,
  saved: LatestAssessment,
  t: TFunction,
): Promise<{ error: string | null }> {
  // Keep untouched answers exactly as stored (some are not plain numbers).
  const touched = new Set([...plan.changed, "fms_total"])
  const answers = Object.entries(plan.results).map(([question_key, value]) => ({
    question_key,
    answer_json: !touched.has(question_key) && saved.answers.has(question_key) ? saved.answers.get(question_key) : { value },
  }))
  if (plan.action === "insert" || !saved.id) return insertAssessment(service, athleteId, row, answers, t)

  const { error } = await service
    .from("athlete_assessment_answers")
    .upsert(answers.filter((answer) => touched.has(answer.question_key)).map((answer) => ({ assessment_id: saved.id, ...answer })), { onConflict: "assessment_id,question_key" })
  if (error) return { error: t("Assessment measurements save failed: {message}", { message: error.message }) }
  if (plan.removed.length) {
    const { error: removeError } = await service.from("athlete_assessment_answers").delete().eq("assessment_id", saved.id).in("question_key", plan.removed)
    if (removeError) return { error: t("Assessment measurements save failed: {message}", { message: removeError.message }) }
  }
  await service.from("athlete_assessments").update({ updated_at: new Date().toISOString() }).eq("id", saved.id)
  return { error: null }
}

async function insertAssessment(service: SupabaseClient, athleteId: string, row: ParsedAthleteRow, answers: Answer[], t: TFunction): Promise<{ error: string | null }> {
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

  if (answers.length) {
    const { error: answersError } = await service.from("athlete_assessment_answers").insert(answers.map((answer) => ({ assessment_id: assessment.id, ...answer })))
    if (answersError) {
      await service.from("athlete_assessments").delete().eq("id", assessment.id)
      return { error: t("Assessment measurements save failed: {message}", { message: answersError.message }) }
    }
  }
  return { error: null }
}
