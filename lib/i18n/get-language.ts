import { cookies } from "next/headers"
import { dictionaries, type Language } from "./dictionaries"
import { localeFor, makeT, type TFunction } from "./translate"

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

/** Server-side translate function for the current request: const t = await getT(). */
export async function getT(): Promise<TFunction> {
  return makeT(await getLanguage())
}

export async function getLocale(): Promise<string> {
  return localeFor(await getLanguage())
}
