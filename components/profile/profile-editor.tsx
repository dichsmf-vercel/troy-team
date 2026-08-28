"use client"
import { useState } from "react"
import { Copy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/components/providers/language-provider"
import { LanguageSwitchButton } from "@/components/language-switch-button"

type Props = { userId: string; email: string; profile: { full_name: string | null; profile_picture_url: string | null; language_preference: string } | null; parentLink: { link_code: string; status: string } | null }
export function ProfileEditor({ userId, email, profile, parentLink }: Props) {
 const { dict } = useLanguage(); const [copied, setCopied] = useState(false); const [name, setName] = useState(profile?.full_name ?? ""); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false)
 async function save() { setSaving(true); setSaved(false); const supabase = createClient(); await supabase.from("profiles").update({ full_name: name, updated_at: new Date().toISOString() }).eq("id", userId); setSaving(false); setSaved(true) }
 return <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 pb-24 md:px-8"><header><p className="text-sm text-muted-foreground">{dict.common.profile}</p><h1 className="text-3xl font-bold">{dict.profile.title}</h1></header><Card><CardHeader><CardTitle>{dict.profile.personalInfo}</CardTitle></CardHeader><CardContent className="flex flex-col gap-5"><div className="flex items-center gap-4"><div className="flex size-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold">{name.slice(0, 1).toUpperCase() || "A"}</div><div><p className="font-semibold">{name || dict.profile.athlete}</p><p className="text-sm text-muted-foreground">{email}</p></div></div><div className="flex flex-col gap-2"><Label htmlFor="name">{dict.profile.fullName}</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} /></div><Button onClick={save} disabled={saving}>{saving ? dict.common.saving : dict.common.save}</Button>{saved && <p className="text-sm text-team-reserve">{dict.common.saved}</p>}</CardContent></Card><Card><CardHeader><CardTitle>Parent access ID</CardTitle></CardHeader><CardContent className="flex flex-col gap-3"><p className="text-sm text-muted-foreground">Share this ID with your parent so they can view your training progress.</p>{parentLink ? <div className="flex items-center gap-2"><Input readOnly value={parentLink.link_code} aria-label="Parent access ID" /><Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(parentLink.link_code); setCopied(true) }}><Copy className="size-4" />{copied ? "Copied" : "Copy"}</Button></div> : <p className="text-sm text-muted-foreground">No active parent access ID has been created yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle>{dict.profile.preferences}</CardTitle></CardHeader><CardContent><LanguageSwitchButton /></CardContent></Card></main>
}
