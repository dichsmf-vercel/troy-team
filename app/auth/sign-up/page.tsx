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

function signUpErrorKey(error: unknown): "weakPassword" | "unexpectedError" {
  const { code } = (error ?? {}) as { code?: string }
  if (code === "weak_password" || code === "validation_failed") return "weakPassword"
  return "unexpectedError"
}

export default function SignUpPage() {
  const { dict, language } = useLanguage()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError(dict.auth.weakPassword)
      setIsLoading(false)
      return
    }

    const supabase = createClient()
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            role: "athlete",
            language_preference: language,
          },
        },
      })
      if (error) throw error
      router.push("/auth/sign-up-success")
    } catch (err) {
      setError(dict.auth[signUpErrorKey(err)])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell appName={dict.app.name} tagline={dict.app.tagline}>
      <Card>
        <CardContent className="pt-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">{dict.auth.signUpTitle}</h2>
            <p className="text-sm text-muted-foreground">{dict.auth.signUpSubtitle}</p>
          </div>
          <form onSubmit={handleSignUp} className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="fullName">{dict.auth.fullName}</Label>
              <Input
                id="fullName"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="repeatPassword">{dict.auth.password}</Label>
              <Input
                id="repeatPassword"
                type="password"
                required
                autoComplete="new-password"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? dict.common.loading : dict.auth.signUpButton}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted-foreground">
            {dict.auth.hasAccount}{" "}
            <Link href="/auth/login" className="font-medium text-foreground underline underline-offset-4">
              {dict.auth.loginLink}
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
