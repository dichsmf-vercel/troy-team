"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { useLanguage } from "@/components/providers/language-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  saveIntakeBasics,
  saveIntakeBody,
  saveIntakeHealth,
  completeIntake,
} from "@/app/intake/actions"

type IntakeData = {
  full_name: string
  age: number | null
  phone: string | null
  weight_kg: number | null
  height_cm: number | null
  injury_notes: string
  goals: string
}

const TOTAL_STEPS = 4

export function IntakeStepper({ initial }: { initial: IntakeData }) {
  const { dict, dir } = useLanguage()
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<IntakeData>(initial)
  const [isPending, startTransition] = useTransition()

  const logoSrc = "/minilogo-removebg-preview.png"

  function update<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  function goNext() {
    startTransition(async () => {
      try {
        if (step === 1) {
          await saveIntakeBasics({ full_name: data.full_name, age: data.age, phone: data.phone })
        } else if (step === 2) {
          await saveIntakeBody({ weight_kg: data.weight_kg, height_cm: data.height_cm })
        } else if (step === 3) {
          await saveIntakeHealth({ injury_notes: data.injury_notes || null, goals: data.goals || null })
        } else if (step === 4) {
          await completeIntake()
          router.push("/dashboard")
          return
        }
        setStep((s) => Math.min(s + 1, TOTAL_STEPS))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : dict.auth.unexpectedError)
      }
    })
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1))
  }

  const progressValue = (step / TOTAL_STEPS) * 100

  return (
    <div className="flex flex-col gap-8" dir={dir}>
      <div className="flex flex-col items-center gap-4">
        <Image src={logoSrc || "/placeholder.svg"} alt="" width={80} height={80} className="size-20 object-contain" priority />
        <div className="w-full flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="tabular">
              {dict.intake.step} {step} {dict.intake.of} {TOTAL_STEPS}
            </span>
            <span>{dict.intake.savedProgress}</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-6">
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-semibold text-balance">{dict.intake.basicsTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">{dict.intake.basicsSubtitle}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="full_name">{dict.auth.fullName}</Label>
              <Input
                id="full_name"
                value={data.full_name}
                onChange={(e) => update("full_name", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="age">{dict.intake.age}</Label>
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                value={data.age ?? ""}
                onChange={(e) => update("age", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">{dict.intake.phone}</Label>
              <Input
                id="phone"
                type="tel"
                value={data.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-semibold text-balance">{dict.intake.bodyTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">{dict.intake.bodySubtitle}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight">{dict.intake.weight}</Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                value={data.weight_kg ?? ""}
                onChange={(e) => update("weight_kg", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="height">{dict.intake.height}</Label>
              <Input
                id="height"
                type="number"
                inputMode="decimal"
                value={data.height_cm ?? ""}
                onChange={(e) => update("height_cm", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-semibold text-balance">{dict.intake.healthTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">{dict.intake.healthSubtitle}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="injury_notes">{dict.intake.injuryNotes}</Label>
              <Textarea
                id="injury_notes"
                placeholder={dict.intake.injuryPlaceholder}
                value={data.injury_notes}
                onChange={(e) => update("injury_notes", e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goals">{dict.intake.goals}</Label>
              <Textarea
                id="goals"
                placeholder={dict.intake.goalsPlaceholder}
                value={data.goals}
                onChange={(e) => update("goals", e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-semibold text-balance">{dict.intake.reviewTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">{dict.intake.reviewSubtitle}</p>
            </div>
            <dl className="flex flex-col gap-3 text-sm">
              <ReviewRow label={dict.auth.fullName} value={data.full_name || "—"} />
              <ReviewRow label={dict.intake.age} value={data.age ? `${data.age} ${dict.common.years}` : "—"} />
              <ReviewRow label={dict.intake.phone} value={data.phone || "—"} />
              <ReviewRow
                label={dict.intake.weight}
                value={data.weight_kg ? `${data.weight_kg} ${dict.common.kg}` : "—"}
              />
              <ReviewRow
                label={dict.intake.height}
                value={data.height_cm ? `${data.height_cm} ${dict.common.cm}` : "—"}
              />
              <ReviewRow label={dict.intake.goals} value={data.goals || "—"} />
            </dl>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          {step > 1 && (
            <Button variant="outline" className="flex-1 rounded-lg" onClick={goBack} disabled={isPending}>
              {dict.common.back}
            </Button>
          )}
          <Button className="flex-1 rounded-lg" onClick={goNext} disabled={isPending}>
            {step === TOTAL_STEPS ? dict.intake.finish : dict.common.continue}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-start">{value}</dd>
    </div>
  )
}
