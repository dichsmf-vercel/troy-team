import { EXERCISE_LIBRARY, type LibraryEntry } from "@/lib/exercise-library"

/** "Barbell Back Squats" / "barbell-back squat" → "barbell back squat" (plural-insensitive). */
export function exerciseNameKey(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((word) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word))
    .join(" ")
}

const BY_NAME = new Map<string, LibraryEntry>(EXERCISE_LIBRARY.map((entry) => [exerciseNameKey(entry.name), entry]))
const BY_CODE = new Map<string, LibraryEntry>(EXERCISE_LIBRARY.map((entry) => [entry.code.toUpperCase(), entry]))

export function findLibraryEntry(input: { code?: string | null; name?: string | null }): LibraryEntry | null {
  if (input.code) {
    const byCode = BY_CODE.get(input.code.trim().toUpperCase())
    if (byCode) return byCode
  }
  return BY_NAME.get(exerciseNameKey(input.name)) ?? null
}

/** Coach Ahmed code (E001…) for an exercise name, if it is in the catalogue CSV. */
export function exerciseCodeForName(name: string | null | undefined): string | null {
  return BY_NAME.get(exerciseNameKey(name))?.code ?? null
}

/**
 * Exercise name in the active language. Catalogue rows were imported with name_ar = name_en,
 * so in Arabic fall back to the built-in translation when the row has no real Arabic name.
 */
export function exerciseDisplayName(nameEn: string | null | undefined, nameAr: string | null | undefined, language: string): string {
  const english = String(nameEn ?? "").trim()
  if (language !== "ar") return english || String(nameAr ?? "")
  const arabic = String(nameAr ?? "").trim()
  if (arabic && arabic !== english && /[؀-ۿ]/.test(arabic)) return arabic
  return findLibraryEntry({ name: english })?.nameAr ?? english
}

const YOUTUBE_ID =/^[A-Za-z0-9_-]{11}$/

/** Extracts the video id from any common YouTube URL shape (watch, youtu.be, shorts, embed, live). */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const value = url.trim()
  if (YOUTUBE_ID.test(value)) return value
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.replace(/^www\.|^m\./, "")
    if (host === "youtu.be") return pick(parsed.pathname.slice(1))
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = parsed.searchParams.get("v")
      if (v) return pick(v)
      const match = parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)
      return match ? pick(match[1]) : null
    }
  } catch {
    return null
  }
  return null
}

function pick(candidate: string): string | null {
  const id = candidate.split(/[/?#&]/)[0]
  return YOUTUBE_ID.test(id) ? id : null
}

/** Privacy-friendly embed URL (no cookies until the athlete presses play). */
export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  const id = youtubeId(url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : null
}

export type ExerciseMedia = { images: string[]; videoUrl: string | null }

/**
 * Media to show for an exercise: what the coach set on the exercise row first,
 * then the built-in library (matched by code or name).
 */
export function resolveExerciseMedia(exercise: {
  name?: string | null
  code?: string | null
  image_url?: string | null
  video_youtube_url?: string | null
}): ExerciseMedia {
  const entry = findLibraryEntry({ code: exercise.code, name: exercise.name })
  const coachImage = exercise.image_url?.trim()
  const images = coachImage ? [coachImage] : entry?.images ?? []
  const coachVideo = exercise.video_youtube_url?.trim()
  const videoUrl = coachVideo && youtubeId(coachVideo)
    ? coachVideo
    : entry?.youtubeId
      ? `https://www.youtube.com/watch?v=${entry.youtubeId}`
      : null
  return { images, videoUrl }
}
