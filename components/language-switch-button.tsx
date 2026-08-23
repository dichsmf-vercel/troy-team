"use client"

import { useTransition } from "react"
import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/providers/language-provider"
import { setLanguage } from "@/app/actions/language"

export function LanguageSwitchButton({ className }: { className?: string }) {
  const { language } = useLanguage()
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = language === "en" ? "ar" : "en"
    startTransition(async () => {
      await setLanguage(next)
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={isPending}
      className={className}
    >
      <Languages className="size-4" aria-hidden="true" />
      {language === "en" ? "العربية" : "English"}
    </Button>
  )
}
