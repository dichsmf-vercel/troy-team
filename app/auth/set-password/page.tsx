"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthShell } from "@/components/auth/auth-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 8 || password !== confirm) {
      setMessage("Use at least 8 characters and make both passwords match.")
      return
    }
    setPending(true)
    const { error } = await createClient().auth.updateUser({ password })
    setMessage(error?.message ?? "Password saved. You can now sign in.")
    setPending(false)
    if (!error) setTimeout(() => router.push("/dashboard"), 800)
  }

  return (
    <AuthShell appName="TROY TEAM" tagline="Finish setting up your athlete account">
      <Card><CardContent className="pt-6"><form onSubmit={submit} className="grid gap-5">
        <div><h1 className="text-2xl">Set your password</h1><p className="mt-2 text-sm text-muted-foreground">Your invitation confirms your email. Create the password you will use to sign in.</p></div>
        <div className="grid gap-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
        <div className="grid gap-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></div>
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
        <Button disabled={pending}>{pending ? "Saving..." : "Save password"}</Button>
      </form></CardContent></Card>
    </AuthShell>
  )
}
