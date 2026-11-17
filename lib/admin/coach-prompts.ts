import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Coach system prompt versions.
 *
 * AI-proposed changes are stored as `pending` and only become `active` after an admin approves
 * them. Requires migration 202611180002_coach_prompt_approval.sql (adds `status`). Until it runs,
 * reads fall back to "latest version" (old behaviour) and proposals are refused (fail closed).
 */

export type CoachPrompt = { id: string; version: number; prompt_text: string; change_summary: string | null; created_at: string }

const UNDEFINED_COLUMN = "42703"

export async function getActiveCoachPrompt(service: SupabaseClient): Promise<CoachPrompt | null> {
  const columns = "id, version, prompt_text, change_summary, created_at"
  const filtered = await service
    .from("coach_system_prompts")
    .select(columns)
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!filtered.error) return (filtered.data as CoachPrompt | null) ?? null

  if (filtered.error.code !== UNDEFINED_COLUMN) return null
  const legacy = await service.from("coach_system_prompts").select(columns).order("version", { ascending: false }).limit(1).maybeSingle()
  return (legacy.data as CoachPrompt | null) ?? null
}

export async function proposeCoachPrompt(
  service: SupabaseClient,
  proposal: { promptText: string; summary: string | null; userId: string },
): Promise<{ error: string | null }> {
  const { data: latest } = await service.from("coach_system_prompts").select("version").order("version", { ascending: false }).limit(1).maybeSingle()

  const { error } = await service.from("coach_system_prompts").insert({
    version: (latest?.version ?? 0) + 1,
    prompt_text: proposal.promptText,
    change_summary: proposal.summary,
    created_by: proposal.userId,
    status: "pending",
  })
  if (error?.code === UNDEFINED_COLUMN) {
    return { error: "Prompt approval is not set up yet. Run migration 202611180002_coach_prompt_approval.sql in Supabase." }
  }
  return { error: error?.message ?? null }
}
