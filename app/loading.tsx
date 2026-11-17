"use client"

import { useT } from "@/components/providers/language-provider"
export default function RootLoading() {
  const t = useT()
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{t("Loading…")}</p>
      </div>
    </div>
  )
}
