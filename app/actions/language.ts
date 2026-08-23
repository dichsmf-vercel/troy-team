"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { LANGUAGE_COOKIE } from "@/lib/i18n/get-language"
import type { Language } from "@/lib/i18n/dictionaries"

export async function setLanguage(language: Language) {
  const cookieStore = await cookies()
  cookieStore.set(LANGUAGE_COOKIE, language, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (data.user) {
    await supabase.from("profiles").update({ language_preference: language }).eq("id", data.user.id)
  }

  revalidatePath("/", "layout")
}
