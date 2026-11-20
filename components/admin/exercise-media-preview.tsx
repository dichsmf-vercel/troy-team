"use client"

import { useState } from "react"
import { ImageIcon } from "lucide-react"
import { ExerciseMedia } from "@/components/session/exercise-media"
import { resolveExerciseMedia } from "@/lib/exercise-media"
import { useT } from "@/components/providers/language-provider"
import type { AdminExercise } from "@/lib/admin/types"

/**
 * The exact photos/video the athlete sees for this exercise when they open the session:
 * the catalogue row (coach-set image/video, by id) first, then the built-in library by code or name.
 * Same resolution as app/(athlete)/program/session/[date]/page.tsx.
 */
export function ExerciseMediaPreview({
  exercise,
  catalog,
}: {
  exercise: { id?: string | null; name_en?: string | null; image_url?: string | null; video_youtube_url?: string | null }
  catalog: AdminExercise[]
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const row = exercise.id ? catalog.find((item) => item.id === exercise.id) : undefined
  const media = resolveExerciseMedia({
    name: exercise.name_en ?? row?.name_en,
    code: row?.exercise_code,
    image_url: row?.image_url ?? exercise.image_url,
    video_youtube_url: row?.video_youtube_url ?? exercise.video_youtube_url,
  })
  if (!media.images.length && !media.videoUrl) return null
  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        <ImageIcon className="size-3.5" aria-hidden="true" />
        {open ? t("Hide what the athlete sees") : t("Show what the athlete sees")}
      </button>
      {open ? <ExerciseMedia name={exercise.name_en ?? ""} images={media.images} videoUrl={media.videoUrl} /> : null}
    </div>
  )
}
