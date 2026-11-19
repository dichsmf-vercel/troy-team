"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type IntakeBasics = {
  full_name: string
  age: number | null
  phone: string | null
}

export type IntakeBody = {
  weight_kg: number | null
  height_cm: number | null
}

export type IntakeHealth = {
  injury_notes: string | null
  goals: string | null
}

async function requireUserId() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    throw new Error("Not authenticated")
  }
  return { supabase, userId: data.user.id }
}

export async function saveIntakeBasics(input: IntakeBasics) {
  const { supabase, userId } = await requireUserId()

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: input.full_name })
    .eq("id", userId)
  if (profileError) throw new Error(profileError.message)

  const { error: athleteError } = await supabase
    .from("athletes")
    .upsert({ id: userId, age: input.age, phone: input.phone })
  if (athleteError) throw new Error(athleteError.message)

  revalidatePath("/intake")
}

export async function saveIntakeBody(input: IntakeBody) {
  const { supabase, userId } = await requireUserId()

  const { error } = await supabase
    .from("athletes")
    .upsert({ id: userId, weight_kg: input.weight_kg, height_cm: input.height_cm })
  if (error) throw new Error(error.message)

  // Going back and forth through the steps re-saves this step: only log a new
  // measurement when the values differ from the latest one.
  const { data: latest } = await supabase
    .from("measurements")
    .select("weight_kg, height_cm")
    .eq("athlete_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const unchanged =
    latest &&
    Number(latest.weight_kg ?? 0) === Number(input.weight_kg ?? 0) &&
    Number(latest.height_cm ?? 0) === Number(input.height_cm ?? 0)

  if ((input.weight_kg || input.height_cm) && !unchanged) {
    await supabase.from("measurements").insert({
      athlete_id: userId,
      weight_kg: input.weight_kg,
      height_cm: input.height_cm,
      notes: "Initial intake measurement",
    })
  }

  revalidatePath("/intake")
}

export async function saveIntakeHealth(input: IntakeHealth) {
  const { supabase, userId } = await requireUserId()

  // `goals` also carries the coach's program mode ("Assigned exercises only ..."):
  // an athlete must not be able to switch that off from the intake form.
  const { data: current } = await supabase.from("athletes").select("goals").eq("id", userId).maybeSingle()
  const coachLockedGoals = String(current?.goals ?? "").startsWith("Assigned exercises only")

  const { error } = await supabase
    .from("athletes")
    .upsert({ id: userId, injury_notes: input.injury_notes, ...(coachLockedGoals ? {} : { goals: input.goals }) })
  if (error) throw new Error(error.message)

  revalidatePath("/intake")
}

export async function completeIntake() {
  const { supabase, userId } = await requireUserId()

  const { error } = await supabase
    .from("athletes")
    .upsert({ id: userId, intake_completed_at: new Date().toISOString() })
  if (error) throw new Error(error.message)

  revalidatePath("/", "layout")
}
