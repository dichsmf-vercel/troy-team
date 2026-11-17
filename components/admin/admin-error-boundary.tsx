"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { useT } from "@/components/providers/language-provider"
import { Button } from "@/components/ui/button"

type Props = { children: ReactNode }
type State = { hasError: boolean; errorId: string }

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorId: "" }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    console.error("[v0] admin boundary captured render error", { errorId, name: error.name, message: error.message, stack: error.stack })
    return { hasError: true, errorId }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[v0] admin boundary component stack", { errorId: this.state.errorId, message: error.message, componentStack: info.componentStack })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return <AdminErrorFallback errorId={this.state.errorId} onRetry={() => this.setState({ hasError: false, errorId: "" })} />
  }
}

function AdminErrorFallback({ errorId, onRetry }: { errorId: string; onRetry: () => void }) {
  const t = useT()
  return (
    <section role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
      <h2 className="font-semibold">{t("The admin section could not render.")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("Check the browser console for the diagnostic ID and component stack.")}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{errorId}</p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>{t("Retry")}</Button>
    </section>
  )
}
