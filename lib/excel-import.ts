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

// ─── Import template ──────────────────────────────────────────────────────────

export type ImportColumn = {
  /** Arabic label shown first in the header. */
  ar: string
  /** English label (also what the parser looks for when detecting the template). */
  en: string
  required?: boolean
  /** Short explanation for Coach Ahmed. */
  hint: string
  hintAr: string
  example1: string | number
  example2: string | number
  width: number
}

/**
 * Single source of truth for the template: the download, the preview table in the import
 * dialog, and the parser's column order (parseAthletesFromExcel, standard format) all follow it.
 * Do not reorder without updating the parser.
 */
export const IMPORT_COLUMNS: ImportColumn[] = [
  { ar: "اسم اللاعب", en: "Full Name", required: true, hint: "Player's full name (Arabic or English). The only required column.", hintAr: "الاسم الكامل للاعب. العمود الوحيد المطلوب.", example1: "محمد احمد", example2: "يوسف مصطفى", width: 28 },
  { ar: "النادي", en: "Club", hint: "Club / team name. A team is created automatically if it does not exist.", hintAr: "اسم النادي. يتم إنشاء الفريق تلقائياً إذا لم يكن موجوداً.", example1: "الطيران", example2: "الجيش", width: 16 },
  { ar: "اللعبة", en: "Sport (e.g. يد, قدم, سلة, فولي, هوكي)", hint: "Handball, football, basketball, volleyball, hockey…", hintAr: "يد، قدم، سلة، فولي، هوكي…", example1: "يد", example2: "يد", width: 16 },
  { ar: "المركز", en: "Position (e.g. GK, RB, Pivot)", hint: "Playing position.", hintAr: "مركز اللعب.", example1: "GK", example2: "RB", width: 16 },
  { ar: "السن او مواليد", en: "Birth Year (e.g. 2010)", hint: "Birth year (2012) or age (14). Used to avoid duplicate athletes.", hintAr: "سنة الميلاد (2012) أو السن (14).", example1: 2012, example2: 2011, width: 14 },
  { ar: "Deep Squat", en: "Deep Squat (0–3)", hint: "FMS score, whole number 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 3, width: 18 },
  { ar: "Hurdle Step", en: "Hurdle Step (0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2, width: 18 },
  { ar: "Inline Lunge", en: "Inline Lunge (0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2, width: 18 },
  { ar: "Shoulder Mobility", en: "Shoulder Mobility (0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 3, width: 22 },
  { ar: "Active Straight-Leg Raise", en: "Active Straight-Leg Raise (0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2, width: 26 },
  { ar: "Trunk Stability Push-Up", en: "Trunk Stability Push-Up (0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2, width: 26 },
  { ar: "Rotary Stability", en: "Rotary Stability (0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2, width: 22 },
  { ar: "الوثب العمودي", en: "Vertical Jump cm (e.g. 35 or 229-35)", hint: "Centimetres. “229-35” (reach-jump) is read as 35.", hintAr: "بالسنتيمتر. الصيغة 229-35 تُقرأ 35.", example1: 30, example2: 27, width: 24 },
  { ar: "العدو", en: "Sprint 30m / 20m sec (e.g. 4.12)", hint: "Seconds.", hintAr: "بالثواني.", example1: 4.1, example2: 4.4, width: 22 },
  { ar: "T-Test", en: "T-Test sec (e.g. 11.20)", hint: "Seconds.", hintAr: "بالثواني.", example1: 11.37, example2: 13.15, width: 18 },
  { ar: "Beep Test", en: "Beep Test Level (e.g. 8.5)", hint: "Level reached.", hintAr: "المستوى الذي وصل إليه اللاعب.", example1: 8, example2: 7, width: 18 },
  { ar: "الضغط", en: "Push Ups count", hint: "Repetitions.", hintAr: "عدد التكرارات.", example1: 15, example2: 10, width: 16 },
  { ar: "العقلة", en: "Pull Ups count", hint: "Repetitions.", hintAr: "عدد التكرارات.", example1: 5, example2: 3, width: 16 },
  { ar: "البلانك", en: "Plank Hold sec", hint: "Seconds.", hintAr: "بالثواني.", example1: 60, example2: 45, width: 16 },
  { ar: "505 يمين", en: "505 Agility R sec", hint: "Seconds, right leg.", hintAr: "بالثواني، الرجل اليمنى.", example1: 3.47, example2: 3.9, width: 18 },
  { ar: "505 شمال", en: "505 Agility L sec", hint: "Seconds, left leg.", hintAr: "بالثواني، الرجل اليسرى.", example1: 3.5, example2: 3.5, width: 18 },
  { ar: "تاريخ القياس", en: "Assessment Date (YYYY-MM-DD)", hint: "Date of the measurements, e.g. 2026-01-15 (or a normal Excel date).", hintAr: "تاريخ القياسات مثل 2026-01-15.", example1: "2026-01-15", example2: "2026-01-15", width: 22 },
  { ar: "الوثب الأفقي", en: "Horizontal Jump cm", hint: "Centimetres.", hintAr: "بالسنتيمتر.", example1: 180, example2: 175, width: 20 },
  { ar: "التجديف", en: "Row Machine Result", hint: "Result on the rowing machine.", hintAr: "نتيجة جهاز التجديف.", example1: "", example2: "", width: 20 },
]

export function importTemplateHeaders(): string[] {
  return IMPORT_COLUMNS.map((column) => `${column.ar} / ${column.en}${column.required ? " *" : ""}`)
}

/** Rows of the first sheet. `withExamples` is only used for the "Example" sheet and tests. */
export function buildTemplateSheetRows(withExamples: boolean): (string | number)[][] {
  const rows: (string | number)[][] = [importTemplateHeaders()]
  if (withExamples) {
    rows.push(IMPORT_COLUMNS.map((column) => column.example1), IMPORT_COLUMNS.map((column) => column.example2))
    // A row with only a name shows that every other column is optional.
    rows.push(IMPORT_COLUMNS.map((column, index) => (index === 0 ? "احمد هاني" : index === 1 ? "الشمس" : index === 4 ? 2013 : "")))
  }
  return rows
}

/**
 * Builds the workbook Coach Ahmed downloads:
 *   1. "Athletes"     — header row only. FILL THIS SHEET (it is the one that gets imported)
 *   2. "Example"      — the same columns with three example players
 *   3. "Instructions" — bilingual explanation of every column
 */
export function generateAthleteImportTemplate(): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  const athletes = XLSX.utils.aoa_to_sheet(buildTemplateSheetRows(false))
  athletes["!cols"] = IMPORT_COLUMNS.map((column) => ({ wch: column.width }))
  XLSX.utils.book_append_sheet(wb, athletes, "Athletes")

  const example = XLSX.utils.aoa_to_sheet(buildTemplateSheetRows(true))
  example["!cols"] = IMPORT_COLUMNS.map((column) => ({ wch: column.width }))
  XLSX.utils.book_append_sheet(wb, example, "Example")

  const instructions = XLSX.utils.aoa_to_sheet([
    ["Troy Team — athlete roster import / استيراد قائمة اللاعبين"],
    [],
    ["1. Fill the first sheet (“Athletes”), one player per row, starting under the header. / املأ الورقة الأولى (Athletes)، لاعب في كل صف."],
    ["2. Only the name is required. Empty cells become “Not Set”. / الاسم فقط مطلوب، والخلايا الفارغة تُترك غير محددة."],
    ["3. Do not rename, move or delete the header row. / لا تغيّر صف العناوين."],
    ["4. Players who already exist (same name and birth year) are skipped. / اللاعبون الموجودون مسبقاً يتم تخطيهم."],
    ["5. After the import you get a Troy ID and a temporary password for each player. Save them! / ستحصل على رقم Troy وكلمة مرور مؤقتة لكل لاعب، احفظها."],
    [],
    ["Column / العمود", "Required / مطلوب", "What to enter", "ماذا تكتب"],
    ...IMPORT_COLUMNS.map((column) => [`${column.ar} / ${column.en}`, column.required ? "Yes / نعم" : "No / لا", column.hint, column.hintAr]),
  ])
  instructions["!cols"] = [{ wch: 52 }, { wch: 16 }, { wch: 70 }, { wch: 46 }]
  XLSX.utils.book_append_sheet(wb, instructions, "Instructions")

  return XLSX.write(wb, { type: "array", bookType: "xlsx" })
}
