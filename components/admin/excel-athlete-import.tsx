"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, Upload } from "lucide-react"
import { importAthletesFromExcel } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  generateAthleteImportTemplate,
  parseAthletesFromExcel,
  type ParsedAthleteRow,
} from "@/lib/excel-import"

type ImportCredential = {
  name: string
  troyId: string
  temporaryPassword: string
}

export function ExcelAthleteImport() {
  const [rows, setRows] = useState<ParsedAthleteRow[] | null>(null)
  const [credentials, setCredentials] = useState<ImportCredential[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFileChange(file: File | undefined) {
    setRows(null)
    setCredentials([])
    setMessage(null)
    if (!file) return

    try {
      const parsed = parseAthletesFromExcel(await file.arrayBuffer())
      if (parsed.error) {
        setMessage(parsed.error)
        return
      }
      if (!parsed.athletes.length) {
        setMessage("No athlete rows were found. Check the spreadsheet headers and data.")
        return
      }
      setRows(parsed.athletes)
      setMessage(`Ready to import ${parsed.athletes.length} athlete${parsed.athletes.length === 1 ? "" : "s"}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read the spreadsheet.")
    }
  }

  function downloadTemplate() {
    const data = generateAthleteImportTemplate()
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "troy-athlete-import-template.xlsx"
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function importRows() {
    if (!rows) return
    setBusy(true)
    setMessage(null)
    setCredentials([])
    try {
      const result = await importAthletesFromExcel(rows)
      setCredentials(result.credentials)
      setMessage(
        result.error
          ? `${result.error}${result.imported ? ` ${result.imported} athlete${result.imported === 1 ? "" : "s"} imported before the error.` : ""}`
          : `Imported ${result.imported} athlete${result.imported === 1 ? "" : "s"}.`
      )
      if (!result.error) setRows(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "An error occurred during Excel import.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4" />
            Bulk import from Excel
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Review the detected row count before creating athlete accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1.5 size-3.5" />
            Download template
          </Button>
          <Input
            type="file"
            accept=".xlsx,.xls"
            aria-label="Choose an Excel athlete roster"
            className="h-8 max-w-xs text-xs"
            onChange={(event) => void handleFileChange(event.currentTarget.files?.[0])}
          />
          {rows && (
            <Button type="button" size="sm" disabled={busy} onClick={() => void importRows()}>
              <Upload className="mr-1.5 size-3.5" />
              {busy ? "Importing…" : `Import ${rows.length} athlete${rows.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </div>
      </CardHeader>
      {(message || credentials.length > 0) && (
        <CardContent className="grid gap-3 pt-0">
          {message && (
            <p role="status" className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
              {message}
            </p>
          )}
          {credentials.length > 0 && (
            <div className="grid gap-2">
              <p className="text-sm font-semibold">Temporary login credentials</p>
              <p className="text-xs text-amber-700">
                Save these credentials now. Temporary passwords are only shown once.
              </p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 font-medium">Athlete</th>
                      <th className="p-2 font-medium">Troy ID</th>
                      <th className="p-2 font-medium">Temporary password</th>
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
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
