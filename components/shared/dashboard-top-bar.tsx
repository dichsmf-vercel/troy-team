"use client"

import Image from "next/image"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LanguageSwitchButton } from "@/components/language-switch-button"
import { createClient } from "@/lib/supabase/client"
import { BRAND } from "@/lib/brand"

export function DashboardTopBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  async function signOut() {
    await createClient().auth.signOut()
    router.replace("/auth/login")
    router.refresh()
  }
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Image src={BRAND.logoDark} alt={BRAND.siteName} width={52} height={52} className="size-13 object-contain dark:hidden" />
        <Image src={BRAND.logoLight} alt={BRAND.siteName} width={52} height={52} className="hidden size-13 object-contain dark:block" />
        {!compact && <div className="min-w-0"><p className="truncate text-sm font-semibold">{BRAND.siteName}</p><p className="truncate text-xs text-muted-foreground">{BRAND.coachName}</p></div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <LanguageSwitchButton className="h-9 px-2 text-xs sm:px-3 sm:text-sm" />
        <Button type="button" variant="outline" size="sm" onClick={signOut} className="h-9 px-2 text-xs sm:px-3 sm:text-sm"><LogOut className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span><span className="sr-only sm:hidden">Sign out</span></Button>
      </div>
    </header>
  )
}
