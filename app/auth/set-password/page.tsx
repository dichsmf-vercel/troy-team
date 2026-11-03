"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthShell } from "@/components/auth/auth-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ShieldCheck } from "lucide-react"

function SetPasswordForm() {
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
      setMessage("Password must be at least 8 characters.")
      setIsError(true)
      return
    }
    if (password !== confirm) {
      setMessage("Passwords don't match.")
      setIsError(true)
      return
    }

    setPending(true)
    setIsError(false)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage(error.message)
      setIsError(true)
      setPending(false)
      return
    }

    // Clear the forced password change flag
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from("profiles")
        .update({ password_change_required: false })
        .eq("id", user.id)
    }

    setMessage("Password saved successfully.")
    setIsError(false)
    setPending(false)
    setTimeout(() => router.push("/dashboard"), 800)
  }

  return (
    <AuthShell appName="TROY TEAM" tagline="Finish setting up your athlete account">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="grid gap-5">
            <div className="flex flex-col gap-2">
              {isForced && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                  <ShieldCheck className="size-4 shrink-0" />
                  You must set a new password before continuing.
                </div>
              )}
              <h1 className="text-xl font-semibold">
                {isForced ? "Create your password" : "Set your password"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isForced
                  ? "Your account was set up by an admin. Create a personal password to secure it."
                  : "Create the password you'll use to sign in."}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">New password</Label>
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
              <Label htmlFor="confirm">Confirm password</Label>
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

            <Button disabled={pending}>
              {pending ? "Saving…" : "Save password"}
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
