"use client"

import { useTheme } from "next-themes"
import { useLanguage } from "@/components/providers/language-provider"

export function AthleteHeader({ title }: { title: string }) {
  const { resolvedTheme } = useTheme()
  const { dir } = useLanguage()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center px-4 py-5" dir={dir}>
        <h1 className="text-2xl font-bold tracking-tight text-balance">{title}</h1>
      </div>
    </header>
  )
}
