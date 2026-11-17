import { readFileSync } from "node:fs"
import path from "node:path"
import * as XLSX from "xlsx"
import { describe, expect, it } from "vitest"
import { IMPORT_CHUNK_SIZE, IMPORT_MAX_ROWS_PER_CALL, findRowProblems, nameKey, validateImportRows } from "@/lib/admin/athlete-import-validation"
import { parseCsvObjects, parseCsvRows } from "@/lib/admin/csv"
import { buildTemplateSheetRows, generateAthleteImportTemplate, IMPORT_COLUMNS, parseAthletesFromExcel } from "@/lib/excel-import"
import { clubKey, normalizeArabic, translateClub, translatePosition, translateSport, transliterateName } from "@/lib/import-dictionary"

function workbookBuffer(rows: (string | number | null)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Athletes")
  return XLSX.write(wb, { type: "array", bookType: "xlsx" })
}

describe("import template (Coach Ahmed's measurement sheet layout)", () => {
  it("has the title, the Arabic header row and the test sub-header row", () => {
    const rows = buildTemplateSheetRows(false)
    expect(rows).toHaveLength(4)
    expect(rows[0][0]).toBe("كشف قياسات")
    expect(rows[2].slice(0, 8)).toEqual(["م", "اسم اللاعب", null, "النادي", "اللعبة", "المركز", "السن او مواليد", "date"])
    expect(rows[3].slice(8, 15)).toEqual(["Deep Squat", "Hurdle Step", "Inline Lunge", "Shoulder Mobility", "Active Straight-Leg Raise", "Trunk Stability Push-Up", "Rotary Stability"])
    expect(rows[3].slice(22, 27)).toEqual(["R", "L", " 12 Sec", "M", "Watt"])
    expect(IMPORT_COLUMNS.length).toBe(26)
  })

  it("an empty template imports nothing", () => {
    const result = parseAthletesFromExcel(workbookBuffer(buildTemplateSheetRows(false)))
    expect(result).toEqual({ athletes: [], error: null })
  })

  it("round-trips the example rows with Arabic mapped to English", () => {
    const result = parseAthletesFromExcel(workbookBuffer(buildTemplateSheetRows(true)))
    expect(result.error).toBeNull()
    expect(result.athletes).toHaveLength(3)

    const [first, second, nameOnly] = result.athletes
    expect(first).toMatchObject({
      fullName: "Mohamed Ahmed",
      fullNameAr: "محمد احمد",
      clubName: "Al Tayaran",
      clubNameAr: "الطيران",
      sport: "handball",
      position: "GK",
      birthYear: 2012,
      deepSquat: 2,
      hurdleStep: 2,
      rotaryStability: 2,
      horizontalJumpCm: 180,
      verticalJumpCm: 30,
      pushUps: 15,
      pullUps: 5,
      plankSec: 60,
      beepTestLevel: 8,
      sprint20mSec: 4,
      agility505RSec: 3.47,
      agility505LSec: 3.5,
      tTestSec: 11.37,
      assessmentDate: "2026-01-15",
    })
    expect(first.fmsTotal).toBe(14)
    expect(second).toMatchObject({ fullName: "Youssef Mostafa", sport: "hockey", position: "RB", shoulderMobility: 3 })
    expect(nameOnly).toMatchObject({ fullName: "Ahmed Hany", clubName: "Al Shams", sport: "handball", birthYear: 2013, position: "Not Set" })
    expect(nameOnly.deepSquat).toBeNull()
    expect(nameOnly.fmsTotal).toBeNull()
  })

  it("generates a workbook with Athletes first, then Example and Instructions", () => {
    const wb = XLSX.read(generateAthleteImportTemplate(), { type: "array" })
    expect(wb.SheetNames).toEqual(["Athletes", "Example", "Instructions"])
    // The downloaded Athletes sheet itself parses (and is empty).
    const buffer = XLSX.write({ SheetNames: ["Athletes"], Sheets: { Athletes: wb.Sheets.Athletes } }, { type: "array", bookType: "xlsx" })
    expect(parseAthletesFromExcel(buffer)).toEqual({ athletes: [], error: null })
  })

  it("finds columns by header text, even when the sheet has extra columns in front", () => {
    const rows = buildTemplateSheetRows(true).map((row) => [null, null, ...row])
    const result = parseAthletesFromExcel(workbookBuffer(rows))
    expect(result.error).toBeNull()
    expect(result.athletes).toHaveLength(3)
    expect(result.athletes[0]).toMatchObject({ fullName: "Mohamed Ahmed", verticalJumpCm: 30, agility505LSec: 3.5 })
  })

  it("reads the date written in the title row when the date column is empty", () => {
    const rows = buildTemplateSheetRows(true)
    rows[0][13] = "تاريخ:  12 / 3 /2026"
    for (const row of rows.slice(4)) row[7] = null
    const result = parseAthletesFromExcel(workbookBuffer(rows))
    expect(result.athletes.map((a) => a.assessmentDate)).toEqual(["2026-03-12", "2026-03-12", "2026-03-12"])
  })

  it("reads rowing metres and watts", () => {
    const rows = buildTemplateSheetRows(false)
    const row = Array<string | number | null>(27).fill(null)
    row[1] = "عمر خالد"
    row[25] = 1850
    row[26] = 210
    const [athlete] = parseAthletesFromExcel(workbookBuffer([...rows, row])).athletes
    expect(athlete).toMatchObject({ fullName: "Omar Khaled", rowMachineResult: 1850, rowMachineWatts: 210 })
  })

  it("reads real measurement sheets without errors", () => {
    for (const file of ["data/2008-M1-5a1c4d.xlsx", "data/Assessment-Sheet-0db1c2.xlsx"]) {
      const buffer = readFileSync(path.join(process.cwd(), file))
      expect(parseAthletesFromExcel(buffer).error).toBeNull()
    }
  })

  it("keeps accepting the earlier English-only template", () => {
    const headers = ["Full Name *", "Club", "Sport", "Position", "Birth Year", "Deep Squat", "Hurdle Step", "Inline Lunge", "Shoulder Mobility", "Straight-Leg Raise", "Trunk Stability", "Rotary Stability", "Vertical Jump"]
    const row = ["Ali Hassan", "Zamalek", "football", "ST", 2010, 2, 2, 2, 2, 2, 2, 2, 31]
    const [athlete] = parseAthletesFromExcel(workbookBuffer([headers, row])).athletes
    expect(athlete).toMatchObject({ fullName: "Ali Hassan", clubName: "Zamalek", sport: "football", position: "Forward", birthYear: 2010, verticalJumpCm: 31, fmsTotal: 14 })
  })

  it("treats Arabic-Indic digits and reach-jump formats as numbers", () => {
    const rows = buildTemplateSheetRows(false)
    const row = Array<string | number | null>(27).fill(null)
    row[1] = "لاعب تجريبي"
    row[6] = "٢٠١٠"
    row[16] = "229-35"
    const [athlete] = parseAthletesFromExcel(workbookBuffer([...rows, row])).athletes
    expect(athlete.birthYear).toBe(2010)
    expect(athlete.verticalJumpCm).toBe(35)
    // Unknown words keep the Arabic name instead of guessing.
    expect(athlete).toMatchObject({ fullName: "لاعب تجريبي", fullNameAr: "لاعب تجريبي" })
  })

  it("reports a clear error when there is no header row", () => {
    expect(parseAthletesFromExcel(workbookBuffer([["a", "b"], [1, 2]])).error).toMatch(/header row/)
  })
})

describe("Arabic → English dictionary", () => {
  it("maps sports and positions", () => {
    expect(translateSport("يد ")).toBe("handball")
    expect(translateSport("فولي")).toBe("volleyball")
    expect(translateSport("هوكي")).toBe("hockey")
    expect(translateSport("كرة قدم")).toBe("football")
    expect(translateSport("Rugby")).toBe("rugby")
    expect(translatePosition("P")).toBe("Pivot")
    expect(translatePosition("gk")).toBe("GK")
    expect(translatePosition("ظهير أيمن")).toBe("RB")
    expect(translatePosition(" ")).toBeNull()
  })

  it("treats club spellings as one club and returns English and Arabic names", () => {
    expect(clubKey("الطيران")).toBe(clubKey("طيران "))
    expect(clubKey("Al Tayaran")).toBe(clubKey("الطيران"))
    expect(translateClub("الاهلي")).toEqual({ en: "Al Ahly", ar: "الاهلي" })
    expect(translateClub("طيران ")).toEqual({ en: "Al Tayaran", ar: "الطيران" })
    expect(translateClub("نادي جديد")).toEqual({ en: "نادي جديد", ar: "نادي جديد" })
    expect(translateClub("Not Set")).toBeNull()
  })

  it("transliterates names only when every word is known", () => {
    expect(transliterateName("يوسف مصطفي")).toEqual({ en: "Youssef Mostafa", ar: "يوسف مصطفي" })
    expect(transliterateName("احمد  محمد ")).toEqual({ en: "Ahmed Mohamed", ar: "احمد محمد" })
    expect(transliterateName("يوسف كلمةغريبة")).toEqual({ en: null, ar: "يوسف كلمةغريبة" })
    expect(transliterateName("John Smith")).toEqual({ en: "John Smith", ar: null })
    expect(normalizeArabic("أحمد")).toBe(normalizeArabic("احمد"))
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
    expect(validateImportRows([row({ rowMachineWatts: "x" })])).toMatchObject({ ok: false })
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
