import * as XLSX from "xlsx"

export type ParsedAthleteRow = {
  rowNumber: number
  fullName: string
  fullNameAr?: string | null
  clubName?: string | null
  sport?: string | null
  position?: string | null
  birthYear?: number | null
  assessmentDate?: string | null
  // FMS
  deepSquat?: number | null
  hurdleStep?: number | null
  inlineLunge?: number | null
  shoulderMobility?: number | null
  activeStraightLegRaise?: number | null
  trunkStability?: number | null
  rotaryStability?: number | null
  fmsTotal?: number | null
  // Performance
  verticalJumpCm?: number | null
  horizontalJumpCm?: number | null
  sprint20mSec?: number | null
  tTestSec?: number | null
  agility505RSec?: number | null
  agility505LSec?: number | null
  pushUps?: number | null
  pullUps?: number | null
  plankSec?: number | null
  beepTestLevel?: number | null
  rowMachineResult?: number | null
  rawNotes?: string | null
}

const SPORT_NORMALIZATION: Record<string, string> = {
  يد: "handball",
  "كرة يد": "handball",
  handball: "handball",
  قدم: "football",
  "كرة قدم": "football",
  football: "football",
  soccer: "football",
  سلة: "basketball",
  "كرة سلة": "basketball",
  basketball: "basketball",
  طائرة: "volleyball",
  "كرة طائرة": "volleyball",
  فولي: "volleyball",
  volleyball: "volleyball",
  هوكي: "hockey",
  hockey: "hockey",
  سباحة: "swimming",
  swimming: "swimming",
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const str = String(val).trim().replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  if (!str) return null
  // Handle formats like "229-30" (standing reach - jump height)
  if (str.includes("-")) {
    const parts = str.split("-")
    if (parts.length === 2 && parts[1].trim()) {
      const second = Number(parts[1])
      if (Number.isFinite(second)) return second
    }
  }
  const n = Number.parseFloat(str.replace(",", "."))
  return Number.isFinite(n) ? n : null
}

function parseBirthYear(val: unknown): number | null {
  if (!val) return null
  const n = parseNumber(val)
  if (!n) return null
  // If it's a 4 digit year like 2012
  if (n >= 1900 && n <= new Date().getFullYear()) return Math.round(n)
  // If it's an age like 12 or 16
  if (n >= 5 && n <= 60) {
    return new Date().getFullYear() - Math.round(n)
  }
  return null
}

export function parseAthletesFromExcel(buffer: Buffer | ArrayBuffer): {
  athletes: ParsedAthleteRow[]
  error: string | null
} {
  try {
    const workbook = XLSX.read(buffer, { type: buffer instanceof ArrayBuffer ? "array" : "buffer" })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { athletes: [], error: "No sheets found in workbook." }

    const sheet = workbook.Sheets[sheetName]
    const sheetRange = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1")
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      range: { s: { r: 0, c: 0 }, e: sheetRange.e },
    })
    if (!rawRows.length) return { athletes: [], error: "The uploaded spreadsheet is empty." }

    // Detect the standard template first so its Arabic name header is not mistaken
    // for the Coach Ahmed workbook's title row.
    let dataStartRow = 1
    let isCoachAhmedFormat = false
    let rowMachineColumn: number | null = null

    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const row = rawRows[i] ?? []
      const joined = row.map((c) => String(c ?? "")).join(" ").toLowerCase()
      if (joined.includes("full name") && joined.includes("birth year")) {
        dataStartRow = i + 1
        rowMachineColumn = findRowMachineColumn(row)
        break
      }
      if (joined.includes("كشف قياسات") || joined.includes("fms score")) {
        isCoachAhmedFormat = true
        dataStartRow = i + 2
        rowMachineColumn = findRowMachineColumn(rawRows[i + 1] ?? [])
        break
      }
      if (row[1] && String(row[1]).includes("اسم اللاعب")) {
        isCoachAhmedFormat = true
        dataStartRow = i + 1
        rowMachineColumn = findRowMachineColumn(row)
        break
      }
    }

    const athletes: ParsedAthleteRow[] = []

    for (let r = dataStartRow; r < rawRows.length; r++) {
      const row = rawRows[r]
      if (!row || !row.length) continue

      let name = ""
      let club: string | null = null
      let sportRaw: string | null = null
      let position: string | null = null
      let birthYearRaw: unknown = null
      let dateVal: unknown = null

      // FMS
      let deepSquat: number | null = null
      let hurdleStep: number | null = null
      let inlineLunge: number | null = null
      let shoulderMobility: number | null = null
      let legRaise: number | null = null
      let trunkStability: number | null = null
      let rotaryStability: number | null = null

      // Performance
      let hJump: number | null = null
      let vJump: number | null = null
      let pushUps: number | null = null
      let pullUps: number | null = null
      let plankSec: number | null = null
      let beepLevel: number | null = null
      let rowMachine: number | null = null
      let sprint20m: number | null = null
      let agilityR: number | null = null
      let agilityL: number | null = null
      let tTest: number | null = null

      if (isCoachAhmedFormat) {
        // Mapped to columns in قياسات_اللعيبه_الغابه.xlsx:
        // Col 1 (B): Name
        // Col 3 (D): Club
        // Col 4 (E): Sport
        // Col 5 (F): Position
        // Col 6 (G): Age / Birth Year
        // Col 7 (H): Date
        // Col 8 (I): Deep Squat
        // Col 9 (J): Hurdle Step
        // Col 10 (K): Inline Lunge
        // Col 11 (L): Shoulder Mobility
        // Col 12 (M): Active Straight-Leg Raise
        // Col 13 (N): Trunk Stability Push-Up
        // Col 14 (O): Rotary Stability
        // Col 15 (P): H Jump
        // Col 16 (Q): V Jump (e.g. 229-30)
        // Col 17 (R): Push Ups
        // Col 18 (S): Pull up
        // Col 19 (T): Plank Hold
        // Col 20 (U): Beep Level
        // Col 21 (V): Anaerobic 20m
        // Col 22 (W): 505 Agility R
        // Col 23 (X): 505 Agility L
        // Col 24 (Y): T-Test
        name = String(row[1] ?? "").trim()
        club = row[3] ? String(row[3]).trim() : null
        sportRaw = row[4] ? String(row[4]).trim() : null
        position = row[5] ? String(row[5]).trim() : null
        birthYearRaw = row[6]
        dateVal = row[7]

        deepSquat = parseNumber(row[8])
        hurdleStep = parseNumber(row[9])
        inlineLunge = parseNumber(row[10])
        shoulderMobility = parseNumber(row[11])
        legRaise = parseNumber(row[12])
        trunkStability = parseNumber(row[13])
        rotaryStability = parseNumber(row[14])

        hJump = parseNumber(row[15])
        vJump = parseNumber(row[16])
        pushUps = parseNumber(row[17])
        pullUps = parseNumber(row[18])
        plankSec = parseNumber(row[19])
        beepLevel = parseNumber(row[20])
        sprint20m = parseNumber(row[21])
        agilityR = parseNumber(row[22])
        agilityL = parseNumber(row[23])
        tTest = parseNumber(row[24])
        rowMachine = rowMachineColumn === null ? null : parseNumber(row[rowMachineColumn])
      } else {
        // Standard template format:
        // Col 0: Name (Arabic or English)
        // Col 1: Club
        // Col 2: Sport
        // Col 3: Position
        // Col 4: Birth Year
        // Col 5: Deep Squat
        // Col 6: Hurdle Step
        // Col 7: Inline Lunge
        // Col 8: Shoulder Mobility
        // Col 9: Leg Raise
        // Col 10: Trunk Stability
        // Col 11: Rotary Stability
        // Cols 12–20: Vertical Jump, sprint, T-Test, beep level, reps, plank, and 505 agility
        // Col 21: Assessment date
        // Col 22: Horizontal Jump (cm)
        // Col 23: Row Machine result
        name = String(row[0] ?? "").trim()
        club = row[1] ? String(row[1]).trim() : null
        sportRaw = row[2] ? String(row[2]).trim() : null
        position = row[3] ? String(row[3]).trim() : null
        birthYearRaw = row[4]

        deepSquat = parseNumber(row[5])
        hurdleStep = parseNumber(row[6])
        inlineLunge = parseNumber(row[7])
        shoulderMobility = parseNumber(row[8])
        legRaise = parseNumber(row[9])
        trunkStability = parseNumber(row[10])
        rotaryStability = parseNumber(row[11])

        vJump = parseNumber(row[12])
        sprint20m = parseNumber(row[13])
        tTest = parseNumber(row[14])
        beepLevel = parseNumber(row[15])
        pushUps = parseNumber(row[16])
        pullUps = parseNumber(row[17])
        plankSec = parseNumber(row[18])
        agilityR = parseNumber(row[19])
        agilityL = parseNumber(row[20])
        dateVal = row[21]
        hJump = parseNumber(row[22])
        rowMachine = rowMachineColumn === null ? null : parseNumber(row[rowMachineColumn])
      }

      // Skip row if no name is found or if it's a repetitive header
      if (!name || name === "اسم اللاعب" || name === "م" || name === "Full Name") continue

      const sportKey = sportRaw?.toLowerCase()
      const normalizedSport = sportKey
        ? Object.prototype.hasOwnProperty.call(SPORT_NORMALIZATION, sportKey)
          ? SPORT_NORMALIZATION[sportKey]
          : sportKey
        : "Not Set"

      const birthYear = parseBirthYear(birthYearRaw)

      // Calculate FMS total if any FMS tests are present
      const fmsScores = [deepSquat, hurdleStep, inlineLunge, shoulderMobility, legRaise, trunkStability, rotaryStability]
      const validFmsScores = fmsScores.filter((s): s is number => s != null)
      const fmsTotal = validFmsScores.length === fmsScores.length
        ? validFmsScores.reduce((a, b) => a + b, 0)
        : null

      let assessmentDate: string | null = null
      if (typeof dateVal === "number") {
        const excelDate = XLSX.SSF.parse_date_code(dateVal)
        if (excelDate) {
          assessmentDate = [
            String(excelDate.y).padStart(4, "0"),
            String(excelDate.m).padStart(2, "0"),
            String(excelDate.d).padStart(2, "0"),
          ].join("-")
        }
      } else if (dateVal) {
        assessmentDate = String(dateVal).trim() || null
      }

      athletes.push({
        rowNumber: r + 1,
        fullName: name,
        fullNameAr: name,
        clubName: club || "Not Set",
        sport: normalizedSport,
        position: position || "Not Set",
        birthYear,
        assessmentDate,
        deepSquat,
        hurdleStep,
        inlineLunge,
        shoulderMobility,
        activeStraightLegRaise: legRaise,
        trunkStability,
        rotaryStability,
        fmsTotal,
        verticalJumpCm: vJump,
        horizontalJumpCm: hJump,
        sprint20mSec: sprint20m,
        tTestSec: tTest,
        agility505RSec: agilityR,
        agility505LSec: agilityL,
        pushUps,
        pullUps,
        plankSec,
        beepTestLevel: beepLevel,
        rowMachineResult: rowMachine,
        rawNotes: club ? `Imported from ${club} roster` : "Bulk Excel Import",
      })
    }

    return { athletes, error: null }
  } catch (err) {
    return {
      athletes: [],
      error: err instanceof Error ? err.message : "Failed to parse Excel workbook.",
    }
  }
}

function findRowMachineColumn(row: unknown[]): number | null {
  const index = row.findIndex((value) => {
    const header = String(value ?? "").toLowerCase()
    return header.includes("row machine") || header.includes("rowing") || header.includes("تجديف")
  })
  return index < 0 ? null : index
}

/**
 * Generates a clean Excel workbook template matching the import columns
 * with bilingual headers and sample rows for Coach Ahmed to distribute.
 */
export function generateAthleteImportTemplate(): ArrayBuffer {
  const headers = [
    "اسم اللاعب / Full Name *",
    "النادي / Club",
    "اللعبة / Sport (e.g. يد, قدم, سلة, فولي, هوكي)",
    "المركز / Position (e.g. GK, RB, Pivot)",
    "السن او مواليد / Birth Year (e.g. 2010)",
    "Deep Squat (0–3)",
    "Hurdle Step (0–3)",
    "Inline Lunge (0–3)",
    "Shoulder Mobility (0–3)",
    "Active Straight-Leg Raise (0–3)",
    "Trunk Stability Push-Up (0–3)",
    "Rotary Stability (0–3)",
    "Vertical Jump cm (e.g. 35 or 229-35)",
    "Sprint 30m / 20m sec (e.g. 4.12)",
    "T-Test sec (e.g. 11.20)",
    "Beep Test Level (e.g. 8.5)",
    "Push Ups count",
    "Pull Ups count",
    "Plank Hold sec",
    "505 Agility R sec",
    "505 Agility L sec",
    "Assessment Date (YYYY-MM-DD)",
    "Horizontal Jump cm",
    "Row Machine Result",
  ]

  const sampleRow1 = [
    "محمد احمد",
    "الطيران",
    "يد",
    "GK",
    2012,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    30,
    4.10,
    11.37,
    8,
    15,
    5,
    60,
    3.47,
    3.50,
    "2026-01-15",
    180,
    "",
  ]

  const sampleRow2 = [
    "يوسف مصطفى",
    "الجيش",
    "يد",
    "RB",
    2011,
    3,
    2,
    2,
    3,
    2,
    2,
    2,
    27,
    4.40,
    13.15,
    7,
    10,
    3,
    45,
    3.90,
    3.50,
    "2026-01-15",
    175,
    "",
  ]

  const sampleRow3 = [
    "احمد هاني (Missing fields default to Not Set)",
    "الشمس",
    "يد",
    "",
    2013,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow1, sampleRow2, sampleRow3])

  // Set column widths
  ws["!cols"] = [
    { wch: 28 }, // Name
    { wch: 16 }, // Club
    { wch: 16 }, // Sport
    { wch: 16 }, // Position
    { wch: 14 }, // Birth Year
    { wch: 18 }, // Deep Squat
    { wch: 18 }, // Hurdle Step
    { wch: 18 }, // Inline Lunge
    { wch: 22 }, // Shoulder Mobility
    { wch: 26 }, // Leg Raise
    { wch: 26 }, // Trunk Stability
    { wch: 22 }, // Rotary Stability
    { wch: 24 }, // V Jump
    { wch: 22 }, // Sprint
    { wch: 18 }, // T-Test
    { wch: 18 }, // Beep Level
    { wch: 16 }, // Push Ups
    { wch: 16 }, // Pull Ups
    { wch: 16 }, // Plank
    { wch: 18 }, // Agility R
    { wch: 18 }, // Agility L
    { wch: 22 }, // Assessment date
    { wch: 20 }, // Horizontal jump
    { wch: 20 }, // Row machine
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Athletes Roster Template")

  return XLSX.write(wb, { type: "array", bookType: "xlsx" })
}
