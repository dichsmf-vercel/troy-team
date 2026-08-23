"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { AuthShell } from "@/components/auth/auth-shell"
import { useLanguage } from "@/components/providers/language-provider"

function loginErrorKey(error: unknown): "invalidCredentials" | "checkEmail" | "unexpectedError" {
  const { code } = (error ?? {}) as { code?: string }
  if (code === "email_not_confirmed") return "checkEmail"
  if (code === "invalid_credentials") return "invalidCredentials"
  return "unexpectedError"
}

export default function LoginPage() {
  const { dict } = useLanguage()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(dict.auth[loginErrorKey(err)])
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
              <Label htmlFor="email">{dict.auth.email}</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
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
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? dict.common.loading : dict.auth.loginButton}
            </Button>
          </form>
          <div className="mt-5 flex flex-col gap-3 text-center text-sm text-muted-foreground">
            <span>
              {dict.auth.noAccount}{" "}
              <Link href="/auth/sign-up" className="font-medium text-foreground underline underline-offset-4">
                {dict.auth.signUpLink}
              </Link>
            </span>
            <Link href="/parent" className="font-medium text-foreground underline underline-offset-4">
              Parent View
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
