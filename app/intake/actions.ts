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

  if (input.weight_kg || input.height_cm) {
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

  const { error } = await supabase
    .from("athletes")
    .upsert({ id: userId, injury_notes: input.injury_notes, goals: input.goals })
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
