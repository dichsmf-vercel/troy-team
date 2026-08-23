import { cookies } from "next/headers"
import { dictionaries, type Language } from "./dictionaries"

export const LANGUAGE_COOKIE = "app_language"

export async function getLanguage(): Promise<Language> {
  const cookieStore = await cookies()
  const value = cookieStore.get(LANGUAGE_COOKIE)?.value
  return value === "ar" ? "ar" : "en"
}

export async function getDictionary() {
  const language = await getLanguage()
  return { language, dict: dictionaries[language] }
}
