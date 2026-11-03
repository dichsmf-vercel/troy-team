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

function loginErrorMessage(error: unknown): string {
  const { code } = (error ?? {}) as { code?: string }
  if (code === "invalid_credentials") return "Incorrect ID/email or password."
  if (code === "email_not_confirmed") return "Confirm your email before signing in."
  return "Something went wrong. Please try again."
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
      setError(loginErrorMessage(err))
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
              <Label htmlFor="identifier">Troy ID or Email</Label>
              <Input
                id="identifier"
                type="text"
                required
                autoComplete="username"
                placeholder="TROY-XXXXXXX or email@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Athletes can sign in with their Troy ID (e.g. TROY-A3X9K2M) or email address.
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
              Parent View
            </a>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
