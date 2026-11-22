"use client"

import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { LanguageSwitchButton } from "@/components/language-switch-button"
import { useLanguage } from "@/components/providers/language-provider"
import { createClient } from "@/lib/supabase/client"
import { tx } from "@/lib/i18n/translate"

/**
 * First-run walkthrough. Opens automatically on a user's first 5 visits (browser sessions) until they
 * finish or skip it; the "?" button in the top bar replays it any time (event "troy:tour").
 * Steps point at elements marked with data-tour="…"; a missing target shows the step centred.
 * The automatic first run also opens each tab as it explains it; a replay only points, so it can never
 * discard unsaved work (a generated program, a half-finished session).
 * Progress lives in localStorage per user and role (no database change).
 */
export type TourRole = "admin" | "athlete"
/** `body` says what the area is for, `how` is the numbered way to use it. */
type Step = { target?: string; title: string; body: string; how?: string[] }

export const TOUR_EVENT = "troy:tour"
const AUTO_VISITS = 5

const STEPS: Record<TourRole, Step[]> = {
  admin: [
    { title: tx("Welcome to the Troy admin workspace"), body: tx("This short tour shows the main areas and how to use them. You can skip it at any time and replay it later from the ? button.") },
    { target: "tab-sessions", title: tx("Sessions"), body: tx("Create training sessions for a team or a single athlete and choose the exercises they will do."), how: [
      tx("Type a title, then choose Team or Individual and who the session is for."),
      tx("Pick the date and start time."),
      tx("Press Add exercise for each exercise and set its sets, reps and load. Drag the handle to change the order."),
      tx("Press Save session. The athletes see it on their home page."),
    ] },
    { target: "tab-athletes", title: tx("Athletes"), body: tx("Your roster, with every athlete's results and settings."), how: [
      tx("Add one athlete with Create athlete, or a whole team with Import from Excel."),
      tx("Save the temporary passwords right away. They are shown only once."),
      tx("Find someone with the search box and filters, then press their name to open their profile."),
      tx("In the profile you can check test results and selfies, reset the password, and choose training days, required selfies and whether upcoming exercises are shown."),
    ] },
    { target: "tab-feedback", title: tx("Feedback"), body: tx("Athletes' effort ratings and pain reports after each session."), how: [
      tx("Check it after every training day."),
      tx("Look at pain reports first, then at unusually high effort (RPE)."),
      tx("Use what you see to change that athlete's next session or program."),
    ] },
    { target: "tab-exercises", title: tx("Exercises"), body: tx("The exercise catalogue. Add your own photo or YouTube link to replace the built-in demo."), how: [
      tx("Press Add exercise to add one that is missing, with its name, category and links."),
      tx("To change a demo video, paste a YouTube link under the exercise and press Save video."),
      tx("Athletes see your photo or video in their sessions straight away."),
    ] },
    { target: "tab-rules", title: tx("Rules"), body: tx("Coach Ahmed's rules that the rules engine applies when it builds programs."), how: [
      tx("Search to see which rules use a test or an exercise."),
      tx("Press Add rule to say: when a test result is above or below a number, add or remove an exercise."),
      tx("To load many rules at once, choose a file and press Import CSV rules."),
    ] },
    { target: "tab-programs", title: tx("Programs"), body: tx("Build 4-week programs and decide what athletes receive."), how: [
      tx("Choose Rules-based or AI, pick the athlete, the start date and the training days, then generate."),
      tx("For an AI program press Edit program to replace, add, remove or move exercises. Your edits teach the next programs."),
      tx("Save it, then press Approve under Programs awaiting review. Athletes see nothing until you approve."),
      tx("If AI prompt proposals appear, approve the preferences you want in every future program and reject the rest."),
    ] },
    { target: "language", title: tx("Language"), body: tx("Switch between Arabic and English.") },
    { target: "tour-help", title: tx("Need this again?"), body: tx("Press ? at any time to replay this tour.") },
  ],
  athlete: [
    { title: tx("Welcome to Troy"), body: tx("This short tour shows where everything is and how to use it. You can skip it at any time and replay it later from the ? button.") },
    { target: "nav-dashboard", title: tx("Home"), body: tx("Today's session, sessions you missed and your next session."), how: [
      tx("Open the app here on every training day."),
      tx("Press today's training to start it."),
      tx("Sessions from your coach are under Assigned trainings. Finish the ones marked Not finished yet."),
    ] },
    { target: "nav-program", title: tx("Program"), body: tx("Your monthly training plan."), how: [
      tx("Press Start training on today's session, or Catch up on one you missed."),
      tx("For each exercise, look at the photos and the demo video, then do the sets and reps shown."),
      tx("Upload a selfie if your coach asks for one, then press Complete Exercise & Continue."),
      tx("At the end, rate how hard it was and report any pain, then submit."),
    ] },
    { target: "nav-progress", title: tx("Progress"), body: tx("Your attendance, effort and test results over time."), how: [
      tx("Check it every week to see how many sessions you attended."),
      tx("Compare your measurements and test results with earlier ones."),
    ] },
    { target: "nav-profile", title: tx("Profile"), body: tx("Your Troy ID, your name and the access code for your parents."), how: [
      tx("Copy your Troy ID. You need it to sign in."),
      tx("Press Create code and send it to your parents so they can follow your progress."),
    ] },
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
  const { t, language } = useLanguage()
  const [key, setKey] = useState<string | null>(null)
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [openTabs, setOpenTabs] = useState(false)
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
      // Open once per browser session. "shown" is only set when the tour actually opens, so a page that
      // mounts twice (e.g. right after sign-in) still shows it.
      let shown = false
      try { shown = sessionStorage.getItem(`troy-tour-shown:${storageKey}`) === "1" } catch { /* ignore */ }
      if (!next.done && next.visits <= AUTO_VISITS && !shown) {
        timer = window.setTimeout(() => {
          if (cancelled) return
          try { sessionStorage.setItem(`troy-tour-shown:${storageKey}`, "1") } catch { /* ignore */ }
          setOpenTabs(!location.pathname.includes("/session/"))
          setStep(0)
        }, 600)
      }
    })
    let timer: number | undefined
    const replay = () => { setOpenTabs(false); setStep(0) }
    window.addEventListener(TOUR_EVENT, replay)
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); window.removeEventListener(TOUR_EVENT, replay) }
  }, [role])

  const measure = useCallback(() => {
    if (step === null) return
    const element = findTarget(steps[step]?.target)
    setRect(element ? element.getBoundingClientRect() : null)
  }, [step, steps])

  useLayoutEffect(() => {
    if (step === null) return
    const target = findTarget(steps[step]?.target)
    if (openTabs && /^(tab|nav)-/.test(steps[step]?.target ?? "")) target?.click()
    target?.scrollIntoView({ block: "center", behavior: "smooth" })
    const timer = window.setTimeout(measure, 350)
    measure()
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true) }
  }, [step, steps, measure, openTabs])

  // Switching language mirrors the page, so the highlighted area moves.
  useEffect(() => {
    const timer = window.setTimeout(measure, 350)
    measure()
    return () => window.clearTimeout(timer)
  }, [language, measure])

  const close = useCallback(() => {
    if (key) write(key, { ...read(key), done: true })
    setStep(null)
  }, [key])

  useEffect(() => {
    if (step === null) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, close])

  if (step === null) return null
  const current = steps[step]

  // Card on the side of the target with more room (scrolls inside when long); centred without a target.
  const pad = 6
  const cardWidth = Math.min(380, window.innerWidth - 24)
  const gap = pad + 10
  const below = rect ? window.innerHeight - rect.bottom >= rect.top : true
  const cardStyle: React.CSSProperties = rect
    ? {
        width: cardWidth,
        left: Math.max(12, Math.min(rect.left + rect.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - 12)),
        top: below ? rect.bottom + gap : undefined,
        bottom: below ? undefined : window.innerHeight - rect.top + gap,
        maxHeight: (below ? window.innerHeight - rect.bottom : rect.top) - gap - 12,
      }
    : { width: cardWidth, maxHeight: window.innerHeight - 24, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }

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
      <div className="fixed flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xl" style={cardStyle}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("Step {current} of {total}", { current: step + 1, total: steps.length })}</p>
          {/* The overlay covers the top bar, so the language can be changed from here too. */}
          <LanguageSwitchButton className="h-8 px-2 text-xs" />
        </div>
        <p className="text-base font-semibold">{t(current.title)}</p>
        <div key={step} className="min-h-0 overflow-y-auto pb-1.5 pe-2 text-sm leading-relaxed">
          <p className="text-muted-foreground">{t(current.body)}</p>
          {current.how ? (
            <>
              <p className="mt-3 font-medium">{t("How to use it")}</p>
              <ol className="mt-1 list-decimal space-y-1 ps-5">
                {current.how.map((line) => <li key={line}>{t(line)}</li>)}
              </ol>
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={close}>{t("Skip tour")}</Button>
          <div className="flex gap-2">
            {step > 0 ? <Button type="button" variant="outline" size="sm" onClick={() => setStep(step - 1)}>{t("Back")}</Button> : null}
            {step < steps.length - 1
              ? <Button type="button" size="sm" onClick={() => setStep(step + 1)}>{t("Next")}</Button>
              : <Button type="button" size="sm" onClick={close}>{t("Done")}</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}
