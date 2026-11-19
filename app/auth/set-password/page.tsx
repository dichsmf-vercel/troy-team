"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { saveOwnPassword } from "./actions"
import { AuthShell } from "@/components/auth/auth-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ShieldCheck } from "lucide-react"
import { useLanguage } from "@/components/providers/language-provider"

function SetPasswordForm() {
  const { dict } = useLanguage()
  const t = dict.auth
  const router = useRouter()
  const searchParams = useSearchParams()
  const isForced = searchParams.get("forced") === "1"

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setMessage(t.passwordTooShort)
      setIsError(true)
      return
    }
    if (password !== confirm) {
      setMessage(t.passwordMismatch)
      setIsError(true)
      return
    }

    setPending(true)
    setIsError(false)
    setMessage(null)

    let result: { error: string | null }
    try {
      result = await saveOwnPassword(password)
    } catch {
      result = { error: t.passwordSaveFailed }
    }
    if (result.error) {
      setMessage(result.error)
      setIsError(true)
      setPending(false)
      return
    }

    setMessage(t.passwordSaved)
    setIsError(false)
    setPending(false)
    setTimeout(() => {
      router.replace("/dashboard")
      router.refresh()
    }, 800)
  }

  return (
    <AuthShell appName={dict.app.name} tagline={t.finishSetupTagline}>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="grid gap-5">
            <div className="flex flex-col gap-2">
              {isForced && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                  <ShieldCheck className="size-4 shrink-0" />
                  {t.forcedPasswordNotice}
                </div>
              )}
              <h1 className="text-xl font-semibold">
                {isForced ? t.createPasswordTitle : t.setPasswordTitle}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isForced
                  ? t.createPasswordForcedBody
                  : t.createPasswordBody}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">{t.newPassword}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">{t.confirmPassword}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {message && (
              <p role="status" className={`text-sm ${isError ? "text-destructive" : "text-emerald-600"}`}>
                {message}
              </p>
            )}

            {/* The Base UI button defaults to type="button", so a form submit must be explicit. */}
            <Button type="submit" disabled={pending}>
              {pending ? t.saving : t.savePassword}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  )
}
