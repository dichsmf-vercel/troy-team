"use client"

import { useRef, useState } from "react"
import { Download, FileSpreadsheet, Upload } from "lucide-react"
import { importAthletesFromExcel, type ImportCredential, type ImportOutcome } from "@/app/admin/actions/imports"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { IMPORT_CHUNK_SIZE, findRowProblems } from "@/lib/admin/athlete-import-validation"
import { useT, useLanguage } from "@/components/providers/language-provider"
import {
  IMPORT_COLUMNS,
  generateAthleteImportTemplate,
  parseAthletesFromExcel,
  type ParsedAthleteRow,
} from "@/lib/excel-import"

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 500
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

type Step = "template" | "review" | "done"

function download(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`

function OutcomeCell({ outcome, label }: { outcome: ImportOutcome; label: string }) {
  const color = { new: "text-emerald-700 dark:text-emerald-300", update: "text-sky-800 dark:text-sky-300", unchanged: "text-muted-foreground", skipped: "text-amber-700 dark:text-amber-300" }[outcome.kind]
  return (
    <>
      <span className={`font-medium ${color}`}>{label}</span>
      {outcome.changes.map((change) => <span key={change} className="block">{change}</span>)}
      {outcome.note ? <span className="block text-amber-700 dark:text-amber-300">{outcome.note}</span> : null}
    </>
  )
}

export function ExcelAthleteImport() {
  const { language } = useLanguage()
  const t = useT()
  const fileInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("template")
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<ParsedAthleteRow[]>([])
  const [problems, setProblems] = useState<{ rowNumber: number; message: string }[]>([])
  const [credentials, setCredentials] = useState<ImportCredential[]>([])
  /** Per-row outcome: the preview in the review step, the real result afterwards. */
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setStep("template")
    setFileName("")
    setRows([])
    setProblems([])
    setCredentials([])
    setOutcomes([])
    setMessage(null)
    setProgress(null)
    if (fileInput.current) fileInput.current.value = ""
  }

  function handleOpenChange(next: boolean) {
    // Never close mid-import, and never lose credentials the coach has not saved yet.
    if (!next && busy) return
    if (!next && credentials.length && !window.confirm(t("Have you saved the temporary passwords? They cannot be shown again."))) return
    setOpen(next)
    if (!next) reset()
  }

  async function handleFile(file: File | undefined) {
    setRows([])
    setProblems([])
    setOutcomes([])
    setMessage(null)
    if (!file) return
    setFileName(file.name)

    if (file.size > MAX_FILE_BYTES) return setMessage(t("The file is larger than 5 MB."))
    try {
      const parsed = parseAthletesFromExcel(await file.arrayBuffer())
      if (parsed.error) return setMessage(t(parsed.error))
      if (!parsed.athletes.length) {
        return setMessage(t("No athlete rows were found. Fill the “Athletes” sheet of the template under the header row."))
      }
      if (parsed.athletes.length > MAX_ROWS) return setMessage(t("The file has {athletesCount} athletes. Import at most {MAX_ROWS} at a time.", { athletesCount: parsed.athletes.length, MAX_ROWS }))
      setRows(parsed.athletes)
      const found = findRowProblems(parsed.athletes, t)
      setProblems(found)
      setStep("review")
      if (!found.length) await preview(parsed.athletes)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Could not read the spreadsheet."))
    }
  }

  /** Runs the whole file in small batches; a dry run only reports what would happen. */
  async function runBatches(list: ParsedAthleteRow[], dryRun: boolean, onBatch?: (credentials: ImportCredential[]) => void) {
    const collected: ImportCredential[] = []
    const all: ImportOutcome[] = []
    let handledIds: string[] = []
    let failure: string | null = null
    try {
      for (let start = 0; start < list.length; start += IMPORT_CHUNK_SIZE) {
        setProgress({ done: start, total: list.length })
        const result = await importAthletesFromExcel(list.slice(start, start + IMPORT_CHUNK_SIZE), { dryRun, handledIds })
        collected.push(...result.credentials)
        all.push(...result.rows)
        onBatch?.([...collected])
        if (result.error) {
          failure = result.error
          break
        }
        handledIds = result.handledIds
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : t("An error occurred during the import.")
    } finally {
      setProgress(null)
    }
    return { all, failure }
  }

  async function preview(list: ParsedAthleteRow[]) {
    setBusy(true)
    const { all, failure } = await runBatches(list, true)
    setOutcomes(failure ? [] : all)
    setMessage(failure)
    setBusy(false)
  }

  async function importRows() {
    if (!rows.length || problems.length) return
    setBusy(true)
    setMessage(null)
    setCredentials([])
    const { all, failure } = await runBatches(rows, false, setCredentials)
    setOutcomes(all)
    setBusy(false)
    const count = (kind: ImportOutcome["kind"]) => all.filter((row) => row.kind === kind).length
    const summary = t("{added} added, {updated} updated, {unchanged} already up to date, {skipped} skipped.", { added: count("new"), updated: count("update"), unchanged: count("unchanged"), skipped: count("skipped") })
    setMessage(failure ? `${failure} ${summary} ${t("Fix it and upload the file again: rows already saved are not repeated.")}` : summary)
    setStep("done")
  }

  const countOf = (kind: ImportOutcome["kind"]) => outcomes.filter((row) => row.kind === kind).length
  const outcomeOf = (rowNumber: number) => outcomes.find((row) => row.rowNumber === rowNumber)
  const outcomeLabel = (row: ImportOutcome) => ({ new: t("New athlete"), update: t("Update"), unchanged: t("No changes"), skipped: t("Skipped") })[row.kind]

  function downloadCredentials() {
    const lines = [["Athlete", "Troy ID", "Temporary password"].map(csvCell).join(",")]
    for (const credential of credentials) lines.push([credential.name, credential.troyId, credential.temporaryPassword].map(csvCell).join(","))
    download(`﻿${lines.join("\r\n")}`, "troy-athlete-credentials.csv", "text/csv;charset=utf-8")
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4" />
            {t("Bulk import from Excel")}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("Add a whole roster at once. You will see the template to follow first.")}</p>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Upload className="mr-1.5 size-3.5" />
          {t("Import from Excel")}
        </Button>
      </CardHeader>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {step === "template" && t("Import athletes from Excel")}
              {step === "review" && t("Review before importing")}
              {step === "done" && t("Import finished")}
            </DialogTitle>
            <DialogDescription>
              {step === "template" && t("Your file must look like this template. Download it, fill it in, then choose it below.")}
              {step === "review" && `${fileName} — ${t.plural(rows.length, "{count} athlete found.", "{count} athletes found.")}`}
              {step === "done" &&
                (credentials.length
                  ? t("Save the login details below. Temporary passwords are only shown once.")
                  : t("No new accounts were created."))}
            </DialogDescription>
          </DialogHeader>

          {step === "template" && (
            <div className="grid gap-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>
                  {t("Download the template and fill the first sheet, “Athletes”, one player per row under the header.")}
                </li>
                <li>
                  {t("Only the name is required. Empty cells are simply left empty.")}
                </li>
                <li>{t("Do not change, move or delete the header row. The “Example” sheet shows three filled-in players.")}</li>
                <li>{t("Athletes who already exist (same name, and same birth year or club) are updated: filled cells replace the saved values, empty cells change nothing. You see every change before saving.")}</li>
              </ol>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 font-medium">#</th>
                      <th className="p-2 font-medium">{t("Column")}</th>
                      <th className="p-2 font-medium">{t("Required")}</th>
                      <th className="p-2 font-medium">{t("What to enter")}</th>
                      <th className="p-2 font-medium">{t("Example")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {IMPORT_COLUMNS.map((column, index) => (
                      <tr key={column.en} className="border-t align-top">
                        <td className="p-2 text-muted-foreground">{index + 1}</td>
                        <td className="p-2">
                          <span dir="rtl" className="block font-medium">{column.ar}</span>
                          <span className="text-muted-foreground">{column.en}</span>
                        </td>
                        <td className="p-2">{column.required ? t("Yes") : t("No")}</td>
                        <td className="p-2">
                          {language === "ar" ? <span dir="rtl">{column.hintAr}</span> : column.hint}
                        </td>
                        <td className="p-2 font-mono">{String(column.example1) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => download(generateAthleteImportTemplate(), "troy-athlete-import-template.xlsx", XLSX_MIME)}>
                  <Download className="mr-1.5 size-4" />
                  {t("Download template (.xlsx)")}
                </Button>
                <Button type="button" onClick={() => fileInput.current?.click()}>
                  <Upload className="mr-1.5 size-4" />
                  {t("Choose filled file")}
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  aria-label={t("Choose an Excel athlete roster")}
                  onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
                />
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="grid gap-3">
              {problems.length > 0 && (
                <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
                  <p className="font-semibold">{t("Fix these rows in Excel, then choose the file again:")}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {problems.slice(0, 15).map((problem) => (
                      <li key={problem.rowNumber}>{problem.message}</li>
                    ))}
                    {problems.length > 15 && <li>{t("…and {count} more.", { count: problems.length - 15 })}</li>}
                  </ul>
                </div>
              )}
              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2 font-medium">{t("Row")}</th>
                      <th className="p-2 font-medium">{t("Name")}</th>
                      <th className="p-2 font-medium">{t("Club")}</th>
                      <th className="p-2 font-medium">{t("Sport")}</th>
                      <th className="p-2 font-medium">{t("Position")}</th>
                      <th className="p-2 font-medium">{t("Birth year")}</th>
                      <th className="p-2 font-medium">{t("FMS total")}</th>
                      <th className="p-2 font-medium">{t("What will happen")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t">
                        <td className="p-2 text-muted-foreground">{row.rowNumber}</td>
                        <td className="p-2">{row.fullName}{row.fullNameAr && row.fullNameAr !== row.fullName ? <span dir="rtl" className="block text-muted-foreground">{row.fullNameAr}</span> : null}</td>
                        <td className="p-2">{row.clubName ?? "—"}</td>
                        <td className="p-2">{row.sport ?? "—"}</td>
                        <td className="p-2">{row.position ?? "—"}</td>
                        <td className="p-2">{row.birthYear ?? "—"}</td>
                        <td className="p-2">{row.fmsTotal ?? "—"}</td>
                        <td className="min-w-48 p-2">{outcomeOf(row.rowNumber) ? <OutcomeCell outcome={outcomeOf(row.rowNumber)!} label={outcomeLabel(outcomeOf(row.rowNumber)!)} /> : busy ? "…" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {progress && (
                <p role="status" className="text-xs text-muted-foreground">
                  {outcomes.length ? t("Importing… {done} of {total}", { done: progress.done, total: progress.total }) : t("Checking… {done} of {total}", { done: progress.done, total: progress.total })}
                </p>
              )}
              {!busy && outcomes.length > 0 && (
                <p role="status" className="text-sm font-medium">
                  {t("{added} new, {updated} to update, {unchanged} already up to date, {skipped} skipped.", { added: countOf("new"), updated: countOf("update"), unchanged: countOf("unchanged"), skipped: countOf("skipped") })}
                </p>
              )}
              {message && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{message}</p>}
            </div>
          )}

          {step === "done" && (
            <div className="grid gap-3">
              {message && <p role="status" className="rounded-lg bg-muted/60 p-2 text-xs">{message}</p>}
              {credentials.length > 0 && (
                <>
                  <p className="text-xs font-medium text-amber-700">{t("Save these now — temporary passwords are shown only once.")}</p>
                  <div className="max-h-64 overflow-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="p-2 font-medium">{t("Athlete")}</th>
                          <th className="p-2 font-medium">{t("Troy ID")}</th>
                          <th className="p-2 font-medium">{t("Temporary password")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credentials.map((credential) => (
                          <tr key={credential.troyId} className="border-t">
                            <td className="p-2">{credential.name}</td>
                            <td className="p-2 font-mono">{credential.troyId}</td>
                            <td className="p-2 font-mono">{credential.temporaryPassword}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={downloadCredentials}>
                      <Download className="mr-1.5 size-3.5" />
                      {t("Download credentials (.csv)")}
                    </Button>
                  </div>
                </>
              )}
              {(["update", "skipped", "unchanged"] as const).map((kind) =>
                countOf(kind) ? (
                  <details key={kind} className="text-xs" open={kind === "skipped"}>
                    <summary className="cursor-pointer font-medium">
                      {kind === "update" ? t("{count} updated", { count: countOf(kind) }) : kind === "skipped" ? t("{count} skipped", { count: countOf(kind) }) : t("{count} already up to date", { count: countOf(kind) })}
                    </summary>
                    <ul className="mt-1 list-disc ps-5">
                      {outcomes.filter((row) => row.kind === kind).map((row) => (
                        <li key={`${row.rowNumber}-${row.name}`}>
                          {t("Row {rowNumber}: {name}", { rowNumber: row.rowNumber, name: row.name })}
                          {row.changes.length ? ` — ${row.changes.join(" · ")}` : ""}
                          {row.note ? ` — ${row.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null,
              )}
            </div>
          )}

          <DialogFooter>
            {step === "template" && message && <p role="status" className="mr-auto text-xs text-destructive">{message}</p>}
            {step === "review" && (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={reset}>
                  {t("Choose another file")}
                </Button>
                <Button type="button" disabled={busy || problems.length > 0 || !(countOf("new") + countOf("update"))} onClick={() => void importRows()}>
                  {busy ? (outcomes.length ? t("Importing…") : t("Checking…")) : t("Save: {added} new, {updated} updated", { added: countOf("new"), updated: countOf("update") })}
                </Button>
              </>
            )}
            {step === "done" && (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {t("Close")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
