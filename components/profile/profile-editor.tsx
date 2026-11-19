"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage, useT } from "@/components/providers/language-provider"
import { ensureParentCode, updateOwnName } from "@/app/(athlete)/profile/actions"

type Props = {
  troyId: string | null
  /** Real e-mail only; internal troy-…@troy.internal addresses are never shown. */
  email: string | null
  profile: { full_name: string | null } | null
  parentCode: string | null
}

export function ProfileEditor({ troyId, email, profile, parentCode: initialParentCode }: Props) {
  const t = useT()
  const { dict } = useLanguage()
  const [name, setName] = useState(profile?.full_name ?? "")
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [parentCode, setParentCode] = useState(initialParentCode)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      setCopiedKey(null)
    }
  }

  function save() {
    startTransition(async () => {
      const result = await updateOwnName(name)
      setMessage(result.error ? { text: result.error, error: true } : { text: dict.common.saved, error: false })
    })
  }

  function createParentCode() {
    startTransition(async () => {
      const result = await ensureParentCode()
      if (result.error) setMessage({ text: result.error, error: true })
      else if (result.code) setParentCode(result.code)
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 pb-24 md:px-8">
      <header>
        <p className="text-sm text-muted-foreground">{dict.common.profile}</p>
        <h1 className="text-3xl font-bold">{dict.profile.title}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("Athlete identity")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{t("Troy ID")}</p>
              <p className="font-mono font-semibold tabular-nums">{troyId ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("Use this ID to sign in.")}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => troyId && copyValue("troy", troyId)} disabled={!troyId}>
              {copiedKey === "troy" ? t("Copied ✓") : t("Copy")}
            </Button>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t("Parent Access Code")}</p>
                <p className="font-mono font-semibold tabular-nums">{parentCode ?? "—"}</p>
              </div>
              {parentCode ? (
                <Button type="button" variant="outline" onClick={() => copyValue("parent", parentCode)}>
                  {copiedKey === "parent" ? t("Copied ✓") : t("Copy")}
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={createParentCode} disabled={pending}>
                  {t("Create code")}
                </Button>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("Share this code with a parent. They enter it on the Parent View page (link on the sign-in screen) to see your schedule and attendance. They cannot change anything.")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.profile.personalInfo}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="flex size-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold">
              {name.slice(0, 1).toUpperCase() || "A"}
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{name || dict.profile.athlete}</p>
              {email ? <p className="truncate text-sm text-muted-foreground">{email}</p> : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{dict.profile.fullName}</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? dict.common.saving : dict.common.save}
          </Button>
          {message ? (
            <p role="status" className={`text-sm ${message.error ? "text-destructive" : "text-team-reserve"}`}>
              {message.text}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
