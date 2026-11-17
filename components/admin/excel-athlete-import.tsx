"use client"

import { useRef, useState } from "react"
import { Download, FileSpreadsheet, Upload } from "lucide-react"
import { importAthletesFromExcel, type ImportCredential, type ImportSkipped } from "@/app/admin/actions/imports"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { IMPORT_CHUNK_SIZE, findRowProblems } from "@/lib/admin/athlete-import-validation"
import { useT } from "@/components/providers/language-provider"
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

export function ExcelAthleteImport() {
  const t = useT()
  const fileInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("template")
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<ParsedAthleteRow[]>([])
  const [problems, setProblems] = useState<{ rowNumber: number; message: string }[]>([])
  const [credentials, setCredentials] = useState<ImportCredential[]>([])
  const [skipped, setSkipped] = useState<ImportSkipped[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setStep("template")
    setFileName("")
    setRows([])
    setProblems([])
    setCredentials([])
    setSkipped([])
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
      setProblems(findRowProblems(parsed.athletes, t))
      setStep("review")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Could not read the spreadsheet."))
    }
  }

  async function importRows() {
    if (!rows.length || problems.length) return
    setBusy(true)
    setMessage(null)
    setCredentials([])
    setSkipped([])

    const collected: ImportCredential[] = []
    const skippedRows: ImportSkipped[] = []
    let imported = 0
    let failure: string | null = null

    try {
      // Small batches keep each request fast; the server skips players that already exist.
      for (let start = 0; start < rows.length; start += IMPORT_CHUNK_SIZE) {
        setProgress({ done: start, total: rows.length })
        const result = await importAthletesFromExcel(rows.slice(start, start + IMPORT_CHUNK_SIZE))
        collected.push(...result.credentials)
        skippedRows.push(...result.skipped)
        imported += result.imported
        setCredentials([...collected])
        if (result.error) {
          failure = result.error
          break
        }
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : t("An error occurred during the import.")
    } finally {
      setProgress(null)
      setBusy(false)
    }

    setSkipped(skippedRows)
    setMessage(
      failure
        ? `${failure} ${t.plural(imported, "{count} athlete was imported before the problem.", "{count} athletes were imported before the problem.")} ${t("Fix it and upload the file again: players already imported are skipped.")}`
        : skippedRows.length
          ? t.plural(imported, "Imported {count} athlete, skipped {skipped} that already exist.", "Imported {count} athletes, skipped {skipped} that already exist.", { skipped: skippedRows.length })
          : t.plural(imported, "Imported {count} athlete.", "Imported {count} athletes."),
    )
    setStep("done")
  }

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
              {step === "done" && t("Save the login details below. Temporary passwords are only shown once.")}
            </DialogDescription>
          </DialogHeader>

          {step === "template" && (
            <div className="grid gap-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>
                  {t("Download the template and fill the first sheet, “Athletes”, one player per row under the header.")}
                </li>
                <li>
                  {t("Only the name is required. Empty cells are saved as “Not Set”.")}
                </li>
                <li>{t("Do not change, move or delete the header row. The “Example” sheet shows three filled-in players.")}</li>
                <li>{t("Players that already exist (same name and birth year) are skipped, so re-uploading is safe.")}</li>
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
                          {column.hint}
                          <span dir="rtl" className="block text-muted-foreground">{column.hintAr}</span>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {progress && (
                <p role="status" className="text-xs text-muted-foreground">
                  {t("Importing… {done} of {total}", { done: progress.done, total: progress.total })}
                </p>
              )}
              {message && <p role="status" className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">{message}</p>}
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
              {skipped.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium">{t("{skippedCount} skipped (already exist)", { skippedCount: skipped.length })}</summary>
                  <ul className="mt-1 list-disc pl-5">
                    {skipped.map((entry) => (
                      <li key={`${entry.rowNumber}-${entry.name}`}>{t("Row {rowNumber}: {name}", { rowNumber: entry.rowNumber, name: entry.name })}</li>
                    ))}
                  </ul>
                </details>
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
                <Button type="button" disabled={busy || problems.length > 0} onClick={() => void importRows()}>
                  {busy ? t("Importing…") : t.plural(rows.length, "Import {count} athlete", "Import {count} athletes")}
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
