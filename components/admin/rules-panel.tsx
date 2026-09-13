"use client"

import { createProgramRule } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RulesPanel({ rules, exercises }: { rules: any[]; exercises: any[] }) {
  const safeRules = Array.isArray(rules) ? rules : []
  const safeExercises = Array.isArray(exercises) ? exercises : []

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle>Create generation rule</CardTitle></CardHeader>
        <CardContent>
          <form action={createProgramRule} className="flex flex-col gap-4">
            <div><Label htmlFor="rule-name">Rule name</Label><Input id="rule-name" name="name" required /></div>
            <div><Label htmlFor="attribute">If athlete attribute</Label><select id="attribute" name="attribute" className="h-10 w-full rounded-sm border bg-background px-3 text-sm"><option value="tier">Tier</option><option value="injury_notes">Injury notes</option><option value="subscription_tier">Subscription tier</option></select></div>
            <div><Label htmlFor="operator">Operator</Label><select id="operator" name="operator" className="h-10 w-full rounded-sm border bg-background px-3 text-sm"><option value="equals">equals</option><option value="contains">contains</option><option value="exists">exists</option></select></div>
            <div><Label htmlFor="value">Value</Label><Input id="value" name="value" required placeholder="elite" /></div>
            <div><Label htmlFor="action">Then</Label><select id="action" name="action" className="h-10 w-full rounded-sm border bg-background px-3 text-sm"><option value="substitute">Substitute exercise</option><option value="inject">Inject exercise</option></select></div>
            <div><Label htmlFor="original">Original exercise</Label><select id="original" name="original_exercise_id" className="h-10 w-full rounded-sm border bg-background px-3 text-sm"><option value="">None</option>{safeExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name_en}</option>)}</select></div>
            <div><Label htmlFor="replacement">Replacement exercise</Label><select id="replacement" name="replacement_exercise_id" className="h-10 w-full rounded-sm border bg-background px-3 text-sm"><option value="">None</option>{safeExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name_en}</option>)}</select></div>
            <Button type="submit">Save rule</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Existing rules</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {safeRules.length === 0 ? <p className="text-sm text-muted-foreground">No rules created yet.</p> : safeRules.map((rule) => <div key={rule.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium">{rule.name || rule.rule_type || "Program rule"}</p><span className="text-xs text-muted-foreground">{rule.is_active === false ? "Inactive" : "Active"}</span></div><p className="mt-1 text-sm text-muted-foreground">{rule.rule_text || `${JSON.stringify(rule.condition_json ?? {})} → ${JSON.stringify(rule.action_json ?? {})}`}</p></div>)}
        </CardContent>
      </Card>
    </div>
  )
}
