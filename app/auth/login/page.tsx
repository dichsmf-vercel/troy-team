"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isTroyId, troyIdToEmail } from "@/lib/troy-id"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { AuthShell } from "@/components/auth/auth-shell"
import { useLanguage } from "@/components/providers/language-provider"
import type { Dictionary } from "@/lib/i18n/dictionaries"

function loginErrorMessage(error: unknown, auth: Dictionary["auth"]): string {
  const { code } = (error ?? {}) as { code?: string }
  if (code === "invalid_credentials") return auth.incorrectCredentials
  if (code === "email_not_confirmed") return auth.confirmEmailFirst
  return auth.unexpectedError
}

export default function LoginPage() {
  const { dict } = useLanguage()
  const [identifier, setIdentifier] = useState("") // email or Troy ID
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const trimmed = identifier.trim()

    // Resolve identifier → email
    let email: string
    if (isTroyId(trimmed)) {
      // Troy ID login — convert to internal fake email
      email = troyIdToEmail(trimmed)
    } else {
      email = trimmed.toLowerCase()
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      // Check if forced password change is required
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("password_change_required")
          .eq("id", user.id)
          .maybeSingle()

        if (profile?.password_change_required) {
          router.push("/auth/set-password?forced=1")
          return
        }
      }

      router.push("/")
      router.refresh()
    } catch (err) {
      setError(loginErrorMessage(err, dict.auth))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell appName={dict.app.name} tagline={dict.app.tagline}>
      <Card>
        <CardContent className="pt-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">{dict.auth.loginTitle}</h2>
            <p className="text-sm text-muted-foreground">{dict.auth.loginSubtitle}</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="identifier">{dict.auth.identifierLabel}</Label>
              <Input
                id="identifier"
                type="text"
                required
                autoComplete="username"
                placeholder={dict.auth.identifierPlaceholder}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {dict.auth.identifierHelp}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{dict.auth.password}</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? dict.common.loading : dict.auth.loginButton}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted-foreground">
            <a href="/parent" className="font-medium text-foreground underline underline-offset-4">
              {dict.auth.parentView}
            </a>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
