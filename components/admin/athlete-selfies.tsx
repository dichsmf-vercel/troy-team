"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { reviewSelfie } from "@/app/admin/actions"

export function AthleteSelfies({ selfies }: { selfies: any[] }) {
  const [items, setItems] = useState(Array.isArray(selfies) ? selfies : [])
  const safeItems = Array.isArray(items) ? items : []
  const groups = safeItems.reduce<Record<string, any[]>>((result, selfie) => {
    const athleteId = selfie?.session_athletes?.athlete_id ?? "unassigned"
    result[athleteId] = [...(result[athleteId] ?? []), selfie]
    return result
  }, {})

  if (!safeItems.length) return null

  return <Card className="lg:col-span-2">
    <CardHeader><CardTitle>Submitted athlete selfies</CardTitle></CardHeader>
    <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(groups).map(([athleteId, athleteSelfies]) => <div key={athleteId} className="rounded-lg border p-3">
        <p className="mb-3 text-sm font-semibold">Athlete {athleteId === "unassigned" ? "unassigned" : athleteId.slice(0, 8)}</p>
        <div className="grid gap-3">
          {athleteSelfies.map((selfie) => <div key={selfie.id} className="overflow-hidden rounded-md border">
            <img src={selfie.image_url} alt="Submitted athlete selfie" className="aspect-square w-full object-cover" />
            <div className="flex items-center justify-between gap-2 p-2"><span className="text-xs text-muted-foreground">{selfie.uploaded_at ? new Date(selfie.uploaded_at).toLocaleDateString() : "Submitted"}</span><Button size="sm" variant="outline" onClick={async () => { await reviewSelfie(selfie.id); setItems((current) => current.filter((item) => item.id !== selfie.id)) }}><Check className="size-4" />Review</Button></div>
          </div>)}
        </div>
      </div>)}
    </CardContent>
  </Card>
}
