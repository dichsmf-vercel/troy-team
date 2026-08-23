"use client"

import { createContext, useContext, useMemo } from "react"
import { dictionaries, type Dictionary, type Language } from "@/lib/i18n/dictionaries"

type LanguageContextValue = {
  language: Language
  dict: Dictionary
  dir: "ltr" | "rtl"
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
