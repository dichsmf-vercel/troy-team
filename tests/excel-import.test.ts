import { readFileSync } from "node:fs"
import path from "node:path"
import * as XLSX from "xlsx"
import { describe, expect, it } from "vitest"
import { IMPORT_CHUNK_SIZE, IMPORT_MAX_ROWS_PER_CALL, findRowProblems, nameKey, validateImportRows } from "@/lib/admin/athlete-import-validation"
import { parseCsvObjects, parseCsvRows } from "@/lib/admin/csv"
import { buildTemplateSheetRows, generateAthleteImportTemplate, IMPORT_COLUMNS, parseAthletesFromExcel } from "@/lib/excel-import"

function workbookBuffer(rows: (string | number)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Athletes")
  return XLSX.write(wb, { type: "array", bookType: "xlsx" })
}

describe("import template", () => {
  it("has one header per column and the parser can detect it", () => {
    const [headers] = buildTemplateSheetRows(false)
    expect(headers).toHaveLength(IMPORT_COLUMNS.length)
    expect(String(headers[0]).toLowerCase()).toContain("full name")
    expect(String(headers[4]).toLowerCase()).toContain("birth year")
  })

  it("an empty template imports nothing (the header is not read as an athlete)", () => {
    const result = parseAthletesFromExcel(workbookBuffer(buildTemplateSheetRows(false)))
    expect(result.error).toBeNull()
    expect(result.athletes).toEqual([])
  })

  it("round-trips the example rows into the right fields", () => {
    const result = parseAthletesFromExcel(workbookBuffer(buildTemplateSheetRows(true)))
    expect(result.error).toBeNull()
    expect(result.athletes).toHaveLength(3)

    const [first, second, nameOnly] = result.athletes
    expect(first).toMatchObject({
      fullName: "محمد احمد",
      clubName: "الطيران",
      sport: "handball",
      position: "GK",
      birthYear: 2012,
      deepSquat: 2,
      verticalJumpCm: 30,
      sprint20mSec: 4.1,
      tTestSec: 11.37,
      pushUps: 15,
      plankSec: 60,
      agility505RSec: 3.47,
      assessmentDate: "2026-01-15",
      horizontalJumpCm: 180,
    })
    expect(first.fmsTotal).toBe(14)
    expect(second.shoulderMobility).toBe(3)
    expect(nameOnly).toMatchObject({ fullName: "احمد هاني", birthYear: 2013, position: "Not Set" })
    expect(nameOnly.deepSquat).toBeNull()
    expect(nameOnly.fmsTotal).toBeNull()
  })

  it("generates a workbook with Athletes first, then Example and Instructions", () => {
    const wb = XLSX.read(generateAthleteImportTemplate(), { type: "array" })
    expect(wb.SheetNames).toEqual(["Athletes", "Example", "Instructions"])
    expect(XLSX.utils.sheet_to_json(wb.Sheets.Athletes, { header: 1 })).toHaveLength(1)
  })

  it("reads the real Coach Ahmed assessment sheets without crashing", () => {
    for (const file of ["data/2008-M1-5a1c4d.xlsx", "data/Assessment-Sheet-0db1c2.xlsx"]) {
      const buffer = readFileSync(path.join(process.cwd(), file))
      const result = parseAthletesFromExcel(buffer)
      expect(result.error).toBeNull()
    }
  })

  it("treats Arabic-Indic digits and reach-jump formats as numbers", () => {
    const rows = buildTemplateSheetRows(false)
    const row: (string | number)[] = IMPORT_COLUMNS.map(() => "")
    row[0] = "لاعب تجريبي"
    row[4] = "٢٠١٠"
    row[12] = "229-35"
    rows.push(row)
    const [athlete] = parseAthletesFromExcel(workbookBuffer(rows)).athletes
    expect(athlete.birthYear).toBe(2010)
    expect(athlete.verticalJumpCm).toBe(35)
  })
})

describe("validateImportRows", () => {
  const row = (overrides: Record<string, unknown> = {}) => ({ rowNumber: 2, fullName: " Ali ", ...overrides })

  it("trims and defaults", () => {
    const result = validateImportRows([row()])
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.rows[0]).toMatchObject({ fullName: "Ali", sport: "Not Set", position: "Not Set" })
  })

  it("rejects bad input", () => {
    expect(validateImportRows([])).toMatchObject({ ok: false })
    expect(validateImportRows([row({ fullName: "  " })])).toMatchObject({ ok: false, error: expect.stringContaining("missing the athlete name") })
    expect(validateImportRows([row({ deepSquat: 5 })])).toMatchObject({ ok: false, error: expect.stringContaining("0–3") })
    expect(validateImportRows([row({ deepSquat: 1.5 })])).toMatchObject({ ok: false })
    expect(validateImportRows([row({ pushUps: "many" })])).toMatchObject({ ok: false, error: expect.stringContaining("numeric") })
  })

  it("limits one call to a chunk-sized batch", () => {
    const many = Array.from({ length: IMPORT_MAX_ROWS_PER_CALL + 1 }, (_, i) => row({ rowNumber: i + 2 }))
    expect(validateImportRows(many)).toMatchObject({ ok: false })
    expect(IMPORT_CHUNK_SIZE).toBeLessThanOrEqual(IMPORT_MAX_ROWS_PER_CALL)
  })

  it("findRowProblems lists every bad row for the preview", () => {
    const problems = findRowProblems([row({ rowNumber: 5, deepSquat: 9 }), row({ rowNumber: 6 }), row({ rowNumber: 7, fullName: "" })] as never)
    expect(problems.map((p) => p.rowNumber)).toEqual([5, 7])
  })
})

describe("nameKey", () => {
  it("matches the same name written in different ways", () => {
    expect(nameKey("أحمد  هاني")).toBe(nameKey("احمد هاني"))
    expect(nameKey("AHMED Hany")).toBe(nameKey("ahmed hany"))
    expect(nameKey("مُحَمَّد")).toBe(nameKey("محمد"))
  })
})

describe("csv", () => {
  it("handles quotes, embedded commas, escaped quotes, CRLF and BOM", () => {
    const rows = parseCsvRows('﻿a,b\r\n"x, y","say ""hi"""\r\n')
    expect(rows).toEqual([["a", "b"], ["x, y", 'say "hi"']])
  })
  it("builds objects from the header", () => {
    expect(parseCsvObjects("full_name,email\nAli,ali@example.com\n\n")).toEqual([{ full_name: "Ali", email: "ali@example.com" }])
  })
})
