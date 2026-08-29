"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, TrendingUp, User } from "lucide-react"
import { useLanguage } from "@/components/providers/language-provider"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()
  const { dict } = useLanguage()

  const items = [
    { href: "/dashboard", label: dict.dashboard.todaysSessions.split(" ")[0], icon: LayoutGrid },
    { href: "/progress", label: dict.progress.title, icon: TrendingUp },
    { href: "/profile", label: dict.profile.title, icon: User },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card">
      <div className="mx-auto max-w-md grid grid-cols-3">
        {items.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "text-accent")} strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
