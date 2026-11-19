"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { loadAthleteActivity } from "@/lib/athlete-activity"
import { getT } from "@/lib/i18n/get-language"

const CODE = /^[A-Za-z0-9-]{6,40}$/

export type ParentViewData = {
  athlete: { name: string | null }
  attendance: { date: string; status: "present" | "absent"; title: string }[]
  upcoming_sessions: { id: string; date: string; title: string }[]
  health_summary: { rpe: number | null; pain_flags: number; symptoms_reported: number }
}

/**
 * Parent read-only access by code. INTENTIONALLY PUBLIC (parents have no account), so it:
 *  - only accepts a well-formed code and returns the same generic error for anything invalid,
 *  - returns the athlete's first name and training summary only (no contact details, IDs or notes).
 * The code is the one shown on the athlete's profile (`athletes.parent_link_code`); an active
 * `parent_links.link_code` is accepted too. Previously the page called a dashboard-only SQL
 * function that only read `parent_links`, so the profile code was always rejected.
 */
export async function redeemParentCode(code: string): Promise<{ error: string | null; data?: ParentViewData }> {
  const t = await getT()
  const invalid = { error: t("That access code is invalid or expired.") }
  const value = typeof code === "string" ? code.trim() : ""
  if (!CODE.test(value)) return invalid

  const service = createAdminClient()
  const { data: athleteByCode } = await service.from("athletes").select("id,account_status").eq("parent_link_code", value).maybeSingle()
  let athleteId = athleteByCode?.id as string | undefined
  if (!athleteId) {
    const { data: link } = await service.from("parent_links").select("athlete_id").eq("link_code", value).eq("status", "active").maybeSingle()
    athleteId = (link?.athlete_id as string | undefined) ?? undefined
  }
  if (!athleteId) return invalid

  const [{ data: profile }, activity] = await Promise.all([
    service.from("profiles").select("full_name,role").eq("id", athleteId).maybeSingle(),
    loadAthleteActivity(service, athleteId, { programSession: t("Program session"), trainingSession: t("Training session") }),
  ])
  if (profile?.role && profile.role !== "athlete") return invalid

  const latestRpe = activity.rpe.at(-1)?.rpe ?? null
  return {
    error: null,
    data: {
      athlete: { name: profile?.full_name?.split(" ")[0] ?? null },
      attendance: activity.attendance.slice(-12).reverse().map((entry) => ({ date: entry.date, status: entry.status, title: entry.title })),
      upcoming_sessions: activity.upcoming.map((entry, index) => ({ id: `${entry.kind}-${index}`, date: entry.date, title: entry.title })),
      health_summary: { rpe: latestRpe, pain_flags: activity.painFlags, symptoms_reported: activity.painFlags },
    },
  }
}
