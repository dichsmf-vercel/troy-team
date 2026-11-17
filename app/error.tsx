"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/components/providers/language-provider"
import { AlertCircle } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useT()
  useEffect(() => {
    // Log to a monitoring service if available
  }, [error])

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-5" />
            {t("Something went wrong")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            {t("An unexpected error occurred. Please try again.")}
          </p>
          <div className="flex gap-3">
            <Button onClick={reset} variant="outline">
              {t("Try again")}
            </Button>
            <a href="/" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90">
              {t("Go home")}
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
