"use client"

import Image from "next/image"
import { useTheme } from "next-themes"
import { useLanguage } from "@/components/providers/language-provider"

export function AthleteHeader({ title }: { title: string }) {
  const { resolvedTheme } = useTheme()
  const { dir } = useLanguage()
  const logoSrc = resolvedTheme === "dark" ? "/logo-dark.jpg" : "/logo-light.jpg"

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-md flex items-center gap-3 px-4 py-4" dir={dir}>
        <Image src={logoSrc || "/placeholder.svg"} alt="" width={32} height={32} className="rounded-md" />
        <h1 className="text-lg font-semibold text-balance">{title}</h1>
      </div>
    </header>
  )
}
