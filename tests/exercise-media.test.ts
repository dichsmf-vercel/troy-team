import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { exerciseCodeForName, resolveExerciseMedia, youtubeEmbedUrl, youtubeId } from "@/lib/exercise-media"
import { EXERCISE_LIBRARY } from "@/lib/exercise-library"
import { addDaysIso, isoDateInAppZone } from "@/lib/dates"

describe("youtubeId", () => {
  it("reads every common URL shape", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=-bJIpOq-LWk")).toBe("-bJIpOq-LWk")
    expect(youtubeId("https://youtu.be/-bJIpOq-LWk?t=3")).toBe("-bJIpOq-LWk")
    expect(youtubeId("https://www.youtube.com/shorts/7-80HiXX1K8")).toBe("7-80HiXX1K8")
    expect(youtubeId("https://m.youtube.com/watch?v=rrJIyZGlK8c&pp=x")).toBe("rrJIyZGlK8c")
    expect(youtubeId("https://www.youtube.com/embed/JO7D6GJ98wY")).toBe("JO7D6GJ98wY")
  })
  it("rejects non-YouTube links", () => {
    expect(youtubeId("https://example.com/watch?v=-bJIpOq-LWk")).toBeNull()
    expect(youtubeId("not a url")).toBeNull()
    expect(youtubeEmbedUrl(null)).toBeNull()
  })
})

describe("exercise library", () => {
  it("covers all 101 catalogue codes with a video", () => {
    expect(EXERCISE_LIBRARY).toHaveLength(101)
    expect(EXERCISE_LIBRARY.every((entry) => entry.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(entry.youtubeId))).toBe(true)
  })
  it("every listed photo exists in public/", () => {
    const missing = EXERCISE_LIBRARY.flatMap((entry) => entry.images).filter((src) => !existsSync(join(process.cwd(), "public", src)))
    expect(missing).toEqual([])
  })
  it("matches names loosely (plural, punctuation)", () => {
    expect(exerciseCodeForName("Barbell Back Squats")).toBe("E001")
    expect(exerciseCodeForName("farmers carry")).toBe("E081")
    expect(exerciseCodeForName("Unknown move")).toBeNull()
  })
  it("prefers the coach's own media over the library", () => {
    const coach = resolveExerciseMedia({ name: "Goblet Squat", image_url: "https://x.test/a.jpg", video_youtube_url: "https://youtu.be/JO7D6GJ98wY" })
    expect(coach.images).toEqual(["https://x.test/a.jpg"])
    expect(coach.videoUrl).toBe("https://youtu.be/JO7D6GJ98wY")
    const fallback = resolveExerciseMedia({ name: "Goblet Squat" })
    expect(fallback.images[0]).toBe("/exercises/media/E003-0.jpg")
    expect(fallback.videoUrl).toContain("youtube.com/watch?v=")
  })
  it("ignores the fake hex video links seeded in the database", () => {
    const seeded = resolveExerciseMedia({ name: "Cat-Cow", code: "E099", video_youtube_url: "https://www.youtube.com/watch?v=3fc6797e7ab" })
    expect(seeded.videoUrl).toBe("https://www.youtube.com/watch?v=Fa4ZMS5M7xA")
    // Without a library video there is nothing better, so the stored link is kept.
    const unknown = resolveExerciseMedia({ name: "Unknown move", video_youtube_url: "https://www.youtube.com/watch?v=3fc6797e7ab" })
    expect(unknown.videoUrl).toBe("https://www.youtube.com/watch?v=3fc6797e7ab")
  })
})

describe("dates", () => {
  it("uses Cairo time, not UTC", () => {
    // 23:30 UTC on Nov 18 is already Nov 19 in Cairo (UTC+2).
    expect(isoDateInAppZone(new Date("2026-11-18T23:30:00Z"))).toBe("2026-11-19")
  })
  it("adds days across month ends", () => {
    expect(addDaysIso("2026-11-29", 3)).toBe("2026-12-02")
    expect(addDaysIso("2026-11-19", -14)).toBe("2026-11-05")
  })
})
