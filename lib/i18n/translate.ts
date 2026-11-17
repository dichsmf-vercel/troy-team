import { arabic } from "@/lib/i18n/ar-translations"
import type { Language } from "@/lib/i18n/dictionaries"

/**
 * Translation by source text.
 *
 *   t('Save')                              -> "حفظ" in Arabic, "Save" in English
 *   t('Imported {count} athletes', { count })
 *
 * The English sentence IS the key. Arabic lives in `ar-translations.ts`. A missing entry falls back to the
 * English text (tests/i18n.test.ts fails the build if any t('…') literal in the source has no Arabic entry).
 * Use `{name}` placeholders instead of string concatenation so Arabic can reorder words.
 */

export type TranslateVars = Record<string, string | number | null | undefined>
export type TFunction = {
  (text: string, vars?: TranslateVars): string
  /** Pick singular/plural by count; {count} is filled in automatically: t.plural(n, '{count} athlete', '{count} athletes'). */
  plural: (count: number, one: string, other: string, vars?: TranslateVars) => string
}

export function translate(language: Language, text: string, vars?: TranslateVars): string {
  const template = language === "ar" ? (arabic[text] ?? text) : text
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key]
    return value === null || value === undefined ? match : String(value)
  })
}

export function makeT(language: Language): TFunction {
  const t = ((text: string, vars?: TranslateVars) => translate(language, text, vars)) as TFunction
  t.plural = (count, one, other, vars) => translate(language, count === 1 ? one : other, { count, ...vars })
  return t
}

/** BCP-47 locale for dates and numbers. Arabic uses Egyptian formatting with Western digits to match the UI. */
export function localeFor(language: Language): string {
  return language === "ar" ? "ar-EG-u-nu-latn" : "en"
}

/** English translator for code that runs without a request (unit tests, defaults). */
export const englishT: TFunction = makeT("en")

/**
 * Marks a constant string as translatable text without translating it yet (module-level labels).
 * Render it with t(label) at the point of use. tests/i18n.test.ts requires an Arabic entry for every tx('…').
 */
export const tx = (text: string): string => text
