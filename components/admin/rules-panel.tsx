"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { importCoachAhmedRules } from "@/app/admin/actions"

export function RulesPanel({ rules, exercises }: { rules: any[]; exercises: any[] }) {
  const [query, setQuery] = React.useState("")
  const exerciseNames = new Map((Array.isArray(exercises) ? exercises : []).map((exercise) => [exercise.id, exercise.name_en]))
  const safeRules = (Array.isArray(rules) ? rules : []).filter((rule) => JSON.stringify(rule).toLowerCase().includes(query.toLowerCase()))
  return <div className="grid gap-6"><Card><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Coach Ahmed rules</CardTitle><p className="text-sm text-muted-foreground">Database-backed rules imported from CoachAhmedRules.csv.</p></div><form action={async () => { await importCoachAhmedRules() }}><Button type="submit" variant="outline">Import CSV rules</Button></form></CardHeader><CardContent><Input aria-label="Search rules" placeholder="Search rule ID, metric, exercise, or action" value={query} onChange={(event) => setQuery(event.target.value)} /></CardContent></Card><Card><CardHeader><CardTitle>{safeRules.length} rules</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">ID</th><th className="p-3">Metric</th><th className="p-3">Operator</th><th className="p-3">Threshold</th><th className="p-3">Action</th><th className="p-3">Exercise</th></tr></thead><tbody>{safeRules.map((rule) => { const condition = rule.condition_json ?? {}; const action = rule.action_json ?? {}; return <tr key={rule.id} className="border-b last:border-0"><td className="p-3 font-medium">{rule.name}</td><td className="p-3">{condition.metric}</td><td className="p-3">{condition.operator}</td><td className="p-3">{condition.threshold}</td><td className="p-3">{action.action}</td><td className="p-3">{action.exercise_id} · {exerciseNames.get(action.exercise_id) ?? "Unresolved"}</td></tr> })}</tbody></table>{!safeRules.length ? <p className="p-6 text-center text-sm text-muted-foreground">No imported rules match this search.</p> : null}</div></CardContent></Card></div>
}
