"use client"

import { useState } from "react"
import { Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { markExerciseSelfieReviewed, reviewSessionSelfie } from "@/app/admin/actions"

type Selfie = {
  id: string
  athlete_id: string
  session_date?: string
  exercise_index?: number
  uploaded_at: string
  image_url: string | null
  // used for session selfies
  session_exercise_id?: string
  selfie_type: "program" | "session"
}

export function AthleteSelfies({ selfies, athleteName }: { selfies: Selfie[]; athleteName: string }) {
  const [items, setItems] = useState<Selfie[]>(Array.isArray(selfies) ? selfies : [])
  const safeItems = Array.isArray(items) ? items : []

  if (!safeItems.length) return null

  async function handleReview(selfie: Selfie) {
    if (selfie.selfie_type === "program") {
      await markExerciseSelfieReviewed(selfie.id)
    } else {
      await reviewSessionSelfie(selfie.id)
    }
    setItems((current) => current.filter((item) => item.id !== selfie.id))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{athleteName}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {safeItems.length} selfie{safeItems.length === 1 ? "" : "s"} awaiting review
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        {safeItems.map((selfie) => (
          <div key={selfie.id} className="grid gap-3 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-sm">
                  {selfie.selfie_type === "program"
                    ? `Exercise ${(selfie.exercise_index ?? 0) + 1}`
                    : "Session exercise"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selfie.session_date ? `${selfie.session_date} · ` : ""}
                  Uploaded {new Date(selfie.uploaded_at).toLocaleString()}
                </p>
              </div>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 text-xs">
                Unread
              </Badge>
            </div>
            {selfie.image_url ? (
              <a href={selfie.image_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
                <img
                  src={selfie.image_url}
                  alt={`${athleteName} exercise selfie`}
                  className="aspect-video w-full object-cover transition-transform hover:scale-[1.02]"
                />
              </a>
            ) : (
              <div className="grid aspect-video place-items-center rounded-lg bg-muted text-sm text-muted-foreground">
                Image unavailable
              </div>
            )}
            <form action={async () => handleReview(selfie)}>
              <Button type="submit" variant="outline" size="sm" className="w-full gap-2">
                <Check className="size-4" />
                Mark reviewed and delete
              </Button>
            </form>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
