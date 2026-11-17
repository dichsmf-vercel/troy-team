"use client"

import { useCallback, useEffect, useState } from "react"
import { Brain, Check, X } from "lucide-react"
import { getPendingPromptProposals, reviewPromptProposal, type PromptProposal } from "@/app/admin/actions/ai"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/components/providers/language-provider"

/**
 * Lists AI-proposed coach-prompt improvements. Nothing changes until an admin approves it.
 * Renders nothing when there is nothing to review (or the viewer is not an admin).
 */
export function PromptProposalsPanel() {
  const t = useT()
  const [proposals, setProposals] = useState<PromptProposal[]>([])
  const [currentPrompt, setCurrentPrompt] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await getPendingPromptProposals()
      if (result.error) return
      setProposals(result.proposals)
      setCurrentPrompt(result.currentPrompt)
    } catch {
      // Not critical: the panel simply stays hidden.
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(id: string, decision: "approve" | "reject") {
    setBusyId(id)
    setMessage(null)
    try {
      const result = await reviewPromptProposal(id, decision)
      setMessage(result.error ?? (decision === "approve" ? t("Prompt approved. It will be used for the next generation.") : t("Proposal rejected.")))
      if (!result.error) await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Could not save your decision."))
    } finally {
      setBusyId(null)
    }
  }

  if (!proposals.length && !message) return null

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="size-4" />
          {t("AI prompt proposals ({proposalsCount})", { proposalsCount: proposals.length })}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("The AI suggested these changes to the coach system prompt after program edits. Review them before they are used.")}
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0">
        {message && (
          <p role="status" className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
            {message}
          </p>
        )}
        {proposals.map((proposal) => (
          <div key={proposal.id} className="grid gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">{t("Version {version}", { version: proposal.version })}</p>
            {proposal.change_summary && <p className="text-xs text-muted-foreground">{proposal.change_summary}</p>}
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">{t("Compare with current prompt")}</summary>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <p className="mb-1 font-medium text-muted-foreground">{t("Current")}</p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2">{currentPrompt || t("(built-in default)")}</pre>
                </div>
                <div>
                  <p className="mb-1 font-medium text-muted-foreground">{t("Proposed")}</p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2">{proposal.prompt_text}</pre>
                </div>
              </div>
            </details>
            <div className="flex gap-2">
              <Button size="sm" disabled={busyId === proposal.id} onClick={() => void decide(proposal.id, "approve")}>
                <Check className="mr-1.5 size-3.5" />
                {t("Approve")}
              </Button>
              <Button size="sm" variant="outline" disabled={busyId === proposal.id} onClick={() => void decide(proposal.id, "reject")}>
                <X className="mr-1.5 size-3.5" />
                {t("Reject")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
