"use client"

import { useEffect, useState } from "react"
import { PlayCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/components/providers/language-provider"
import { youtubeEmbedUrl } from "@/lib/exercise-media"

/**
 * Exercise photo(s) + embedded demo video, used by both session runners.
 * Two photos (start / end position) alternate slowly so the athlete sees the movement.
 */
export function ExerciseMedia({ name, images, videoUrl }: { name: string; images: string[]; videoUrl: string | null }) {
  const t = useT()
  const [frame, setFrame] = useState(0)
  const [showVideo, setShowVideo] = useState(false)
  const embed = youtubeEmbedUrl(videoUrl)

  // New exercise → back to the first photo, video closed.
  useEffect(() => {
    setFrame(0)
    setShowVideo(false)
  }, [name, videoUrl, images.length])

  useEffect(() => {
    if (images.length < 2 || showVideo) return
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % images.length), 1400)
    return () => window.clearInterval(timer)
  }, [images.length, showVideo])

  if (!images.length && !embed) return null

  return (
    <div className="grid gap-2">
      {showVideo && embed ? (
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          <iframe
            className="size-full"
            src={embed}
            title={t("{name} demo", { name })}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : images.length ? (
        <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- local/static images, no optimisation needed */}
          <img
            src={images[frame] ?? images[0]}
            alt={t("{name} demonstration photo", { name })}
            className="size-full object-cover"
            loading="lazy"
          />
          {images.length > 1 ? (
            <span className="absolute bottom-2 start-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
              {frame === 0 ? t("Start position") : t("End position")}
            </span>
          ) : null}
        </div>
      ) : null}

      {embed ? (
        <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowVideo((value) => !value)}>
          {showVideo ? <X className="size-4" /> : <PlayCircle className="size-4" />}
          {showVideo ? t("Hide video") : t("Watch demo video")}
        </Button>
      ) : null}
    </div>
  )
}
