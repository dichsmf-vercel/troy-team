"use client"

import { createContext, useContext, useMemo } from "react"
import { dictionaries, type Dictionary, type Language } from "@/lib/i18n/dictionaries"
import { localeFor, makeT, type TFunction } from "@/lib/i18n/translate"

type LanguageContextValue = {
  language: Language
  dict: Dictionary
  dir: "ltr" | "rtl"
  /** Translate by English source text: t('Save'), t('Imported {count}', { count }). */
  t: TFunction
  /** Locale for toLocaleDateString / Intl. */
  locale: string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  language,
  children,
}: {
  language: Language
  children: React.ReactNode
}) {
  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      dict: dictionaries[language],
      dir: language === "ar" ? "rtl" : "ltr",
      t: makeT(language),
      locale: localeFor(language),
    }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return ctx
}

/** Shortcut for components that only need the translate function. */
export function useT(): TFunction {
  return useLanguage().t
}

/** Picks the Arabic version of a bilingual database field when the UI is Arabic and a value exists. */
export function useLn(): (en: string | null | undefined, ar: string | null | undefined) => string {
  const { language } = useLanguage()
  return (en, ar) => (language === "ar" && ar && ar.trim() ? ar : (en ?? ""))
}
