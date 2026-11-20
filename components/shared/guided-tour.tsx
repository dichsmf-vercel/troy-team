"use client"

import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useT } from "@/components/providers/language-provider"
import { createClient } from "@/lib/supabase/client"
import { tx } from "@/lib/i18n/translate"

/**
 * First-run walkthrough. Opens automatically on a user's first 5 visits (browser sessions) until they
 * finish or skip it; the "?" button in the top bar replays it any time (event "troy:tour").
 * Steps point at elements marked with data-tour="…"; a missing target shows the step centred.
 * Progress lives in localStorage per user and role (no database change).
 */
export type TourRole = "admin" | "athlete"
type Step = { target?: string; title: string; body: string }

export const TOUR_EVENT = "troy:tour"
const AUTO_VISITS = 5

const STEPS: Record<TourRole, Step[]> = {
  admin: [
    { title: tx("Welcome to the Troy admin workspace"), body: tx("This short tour shows the main areas. You can skip it at any time and replay it later from the ? button.") },
    { target: "tab-sessions", title: tx("Sessions"), body: tx("Create training sessions for a team or a single athlete and choose the exercises they will do.") },
    { target: "tab-athletes", title: tx("Athletes"), body: tx("Your roster. Open an athlete to see test results and selfies, reset a password, or change settings such as required selfies and showing upcoming exercises. Roster sheets are imported here too.") },
    { target: "tab-feedback", title: tx("Feedback"), body: tx("Athletes' effort ratings and pain reports after each session.") },
    { target: "tab-exercises", title: tx("Exercises"), body: tx("The exercise catalogue. Add your own photo or YouTube link to replace the built-in demo.") },
    { target: "tab-rules", title: tx("Rules"), body: tx("Coach Ahmed's rules that the rules engine applies when it builds programs.") },
    { target: "tab-programs", title: tx("Programs"), body: tx("Generate a 4-week program with the rules engine or AI, edit it (your edits teach the AI), then approve it so the athlete can see it.") },
    { target: "language", title: tx("Language"), body: tx("Switch between Arabic and English.") },
    { target: "tour-help", title: tx("Need this again?"), body: tx("Press ? at any time to replay this tour.") },
  ],
  athlete: [
    { title: tx("Welcome to Troy"), body: tx("This short tour shows where everything is. You can skip it at any time and replay it later from the ? button.") },
    { target: "nav-dashboard", title: tx("Home"), body: tx("Today's session, sessions you missed and your next session.") },
    { target: "nav-program", title: tx("Program"), body: tx("Your monthly program. Open today's session to train; missed sessions can be caught up.") },
    { target: "nav-progress", title: tx("Progress"), body: tx("Your attendance, effort and test results over time.") },
    { target: "nav-profile", title: tx("Profile"), body: tx("Your Troy ID, your name and the access code for your parents.") },
    { target: "language", title: tx("Language"), body: tx("Switch between Arabic and English.") },
    { target: "tour-help", title: tx("Need this again?"), body: tx("Press ? at any time to replay this tour.") },
  ],
}

type Stored = { visits: number; done: boolean }
const read = (key: string): Stored => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null")
    return value && typeof value.visits === "number" ? value : { visits: 0, done: false }
  } catch {
    return { visits: 0, done: false }
  }
}
const write = (key: string, value: Stored) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode: tour just won't remember */ }
}

function findTarget(name?: string): HTMLElement | null {
  if (!name) return null
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)]
  return all.find((element) => element.offsetParent !== null || element.getClientRects().length > 0) ?? null
}

export function GuidedTour({ role }: { role: TourRole }) {
  const t = useT()
  const [key, setKey] = useState<string | null>(null)
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const steps = STEPS[role]

  // Count this visit (once per browser session) and decide whether to open automatically.
  useEffect(() => {
    let cancelled = false
    createClient().auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return
      const storageKey = `troy-tour:${role}:${data.user.id}`
      setKey(storageKey)
      const stored = read(storageKey)
      const sessionFlag = `troy-tour-counted:${storageKey}`
      let counted = false
      try { counted = sessionStorage.getItem(sessionFlag) === "1" } catch { /* ignore */ }
      const next = counted ? stored : { ...stored, visits: stored.visits + 1 }
      if (!counted) {
        write(storageKey, next)
        try { sessionStorage.setItem(sessionFlag, "1") } catch { /* ignore */ }
      }
      if (!next.done && next.visits <= AUTO_VISITS && !counted) window.setTimeout(() => setStep(0), 600)
    })
    const replay = () => setStep(0)
    window.addEventListener(TOUR_EVENT, replay)
    return () => { cancelled = true; window.removeEventListener(TOUR_EVENT, replay) }
  }, [role])

  const measure = useCallback(() => {
    if (step === null) return
    const element = findTarget(steps[step]?.target)
    setRect(element ? element.getBoundingClientRect() : null)
  }, [step, steps])

  useLayoutEffect(() => {
    if (step === null) return
    findTarget(steps[step]?.target)?.scrollIntoView({ block: "center", behavior: "smooth" })
    const timer = window.setTimeout(measure, 350)
    measure()
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true) }
  }, [step, steps, measure])

  if (step === null) return null
  const current = steps[step]
  const close = (finished: boolean) => {
    if (key) write(key, { ...read(key), done: true })
    setStep(null)
    void finished
  }

  // Card below the target when there is room, otherwise above; centred when there is no target.
  const pad = 6
  const cardWidth = Math.min(340, window.innerWidth - 24)
  const below = rect ? rect.bottom + 180 < window.innerHeight : true
  const cardStyle: React.CSSProperties = rect
    ? {
        width: cardWidth,
        left: Math.max(12, Math.min(rect.left + rect.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - 12)),
        top: below ? rect.bottom + pad + 10 : undefined,
        bottom: below ? undefined : window.innerHeight - rect.top + pad + 10,
      }
    : { width: cardWidth, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={t("App tour")}>
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-lg ring-2 ring-primary transition-all"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/55" />
      )}
      <div className="fixed grid gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xl" style={cardStyle}>
        <p className="text-xs text-muted-foreground">{t("Step {current} of {total}", { current: step + 1, total: steps.length })}</p>
        <p className="text-base font-semibold">{t(current.title)}</p>
        <p className="text-sm text-muted-foreground">{t(current.body)}</p>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => close(false)}>{t("Skip tour")}</Button>
          <div className="flex gap-2">
            {step > 0 ? <Button type="button" variant="outline" size="sm" onClick={() => setStep(step - 1)}>{t("Back")}</Button> : null}
            {step < steps.length - 1
              ? <Button type="button" size="sm" onClick={() => setStep(step + 1)}>{t("Next")}</Button>
              : <Button type="button" size="sm" onClick={() => close(true)}>{t("Done")}</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}
