import * as XLSX from "xlsx"
import { translateClub, translatePosition, translateSport, transliterateName } from "@/lib/import-dictionary"

/**
 * Roster import. The expected layout is Coach Ahmed's measurement sheet ("كشف قياسات"): a title row, one header row
 * (اسم اللاعب / النادي / اللعبة / المركز / السن او مواليد / date / tests…) and one sub-header row (FMS test names,
 * Push Ups, R/L, M/Watt…). Columns are found by their header text, so reordered or extra columns still work.
 * Arabic words are mapped to English (sports, positions, clubs, player names) by `lib/import-dictionary.ts`.
 */

export type ParsedAthleteRow = {
  rowNumber: number
  /** English name when every word is known, otherwise the Arabic name as written. */
  fullName: string
  /** Original Arabic name, when the sheet had one. */
  fullNameAr?: string | null
  clubName?: string | null
  clubNameAr?: string | null
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
  rowMachineWatts?: number | null
  rawNotes?: string | null
}

// ─── Cell parsing ─────────────────────────────────────────────────────────────

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const str = String(val)
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
  if (!str) return null
  // "229-30" (standing reach – jump height): the jump is the part after the dash.
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
  if (n >= 1900 && n <= new Date().getFullYear()) return Math.round(n) // 2012
  if (n >= 5 && n <= 60) return new Date().getFullYear() - Math.round(n) // an age like 14
  return null
}

function parseDate(val: unknown): string | null {
  if (typeof val === "number") {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (!parsed) return null
    return [String(parsed.y).padStart(4, "0"), String(parsed.m).padStart(2, "0"), String(parsed.d).padStart(2, "0")].join("-")
  }
  const text = String(val ?? "").trim()
  if (!text) return null
  const slash = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(text)
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`
  return text
}

const cellText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim()

// ─── Column detection ─────────────────────────────────────────────────────────

type Columns = {
  name: number
  club: number
  sport: number
  position: number
  birth: number
  date: number
  fms: number[]
  hJump: number
  vJump: number
  pushUps: number
  pullUps: number
  plank: number
  beep: number
  sprint20: number
  agilityR: number
  agilityL: number
  tTest: number
  rowM: number
  rowWatt: number
}

/** Positions in Coach Ahmed's sheet, used when a header cannot be found. */
const SHEET_COLUMNS: Columns = {
  name: 1, club: 3, sport: 4, position: 5, birth: 6, date: 7,
  fms: [8, 9, 10, 11, 12, 13, 14],
  hJump: 15, vJump: 16, pushUps: 17, pullUps: 18, plank: 19, beep: 20, sprint20: 21, agilityR: 22, agilityL: 23, tTest: 24, rowM: 25, rowWatt: 26,
}

/** Positions in the earlier English-only template (still accepted). */
const LEGACY_COLUMNS: Columns = {
  name: 0, club: 1, sport: 2, position: 3, birth: 4, date: 21,
  fms: [5, 6, 7, 8, 9, 10, 11],
  vJump: 12, sprint20: 13, tTest: 14, beep: 15, pushUps: 16, pullUps: 17, plank: 18, agilityR: 19, agilityL: 20, hJump: 22, rowM: 23, rowWatt: -1,
}

const FMS_PATTERNS = [/deep\s*squat/i, /hurdle/i, /inline\s*lunge/i, /shoulder\s*mobility/i, /straight[\s-]*leg/i, /trunk\s*stability/i, /rotary/i]

function indexOfMatch(cells: unknown[], pattern: RegExp, from = 0): number {
  for (let i = from; i < cells.length; i++) if (pattern.test(cellText(cells[i]))) return i
  return -1
}

function detectColumns(head: unknown[], sub: unknown[], legacy: boolean): Columns {
  if (legacy) {
    const rowMachine = indexOfMatch(head, /row\s*mach|rowing|تجديف/i)
    return { ...LEGACY_COLUMNS, rowM: rowMachine >= 0 ? rowMachine : LEGACY_COLUMNS.rowM }
  }
  const pick = (found: number, fallback: number) => (found >= 0 ? found : fallback)
  const both = (pattern: RegExp) => {
    const inSub = indexOfMatch(sub, pattern)
    return inSub >= 0 ? inSub : indexOfMatch(head, pattern)
  }
  const fms = FMS_PATTERNS.map((pattern, i) => pick(indexOfMatch(sub, pattern), SHEET_COLUMNS.fms[i]))
  const rowGroup = indexOfMatch(head, /row\s*mach|تجديف/i)
  const rowM = pick(indexOfMatch(sub, /^M$/i), rowGroup >= 0 ? rowGroup : SHEET_COLUMNS.rowM)
  return {
    name: pick(indexOfMatch(head, /اسم\s*اللاعب|full\s*name|player/i), SHEET_COLUMNS.name),
    club: pick(indexOfMatch(head, /النادي|club|team/i), SHEET_COLUMNS.club),
    sport: pick(indexOfMatch(head, /اللعب[هة]|sport/i), SHEET_COLUMNS.sport),
    position: pick(indexOfMatch(head, /المركز|position/i), SHEET_COLUMNS.position),
    birth: pick(indexOfMatch(head, /السن|مواليد|birth|\bage\b/i), SHEET_COLUMNS.birth),
    date: pick(indexOfMatch(head, /^date$|تاريخ القياس|assessment\s*date/i), SHEET_COLUMNS.date),
    fms,
    hJump: pick(both(/h\s*jum|horizontal/i), SHEET_COLUMNS.hJump),
    vJump: pick(both(/v\s*jum|vertical/i), SHEET_COLUMNS.vJump),
    pushUps: pick(indexOfMatch(sub, /push\s*ups?/i), SHEET_COLUMNS.pushUps),
    pullUps: pick(indexOfMatch(sub, /pull[\s-]*ups?/i), SHEET_COLUMNS.pullUps),
    plank: pick(indexOfMatch(sub, /plank/i), SHEET_COLUMNS.plank),
    beep: pick(indexOfMatch(sub, /level|beep/i), SHEET_COLUMNS.beep),
    sprint20: pick(indexOfMatch(head, /anaerobic|20\s*m/i), SHEET_COLUMNS.sprint20),
    agilityR: pick(indexOfMatch(sub, /^R$/i), SHEET_COLUMNS.agilityR),
    agilityL: pick(indexOfMatch(sub, /^L$/i), SHEET_COLUMNS.agilityL),
    tTest: pick(indexOfMatch(head, /t-?\s*test/i), SHEET_COLUMNS.tTest),
    rowM,
    rowWatt: pick(indexOfMatch(sub, /watt/i), rowM + 1),
  }
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const HEADER_WORDS = new Set(["م", "اسم اللاعب", "full name", "name"])

export function parseAthletesFromExcel(buffer: Buffer | ArrayBuffer): { athletes: ParsedAthleteRow[]; error: string | null } {
  try {
    const workbook = XLSX.read(buffer, { type: buffer instanceof ArrayBuffer ? "array" : "buffer" })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { athletes: [], error: "No sheets found in workbook." }

    const sheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: true })
    if (!rawRows.length) return { athletes: [], error: "The uploaded spreadsheet is empty." }

    // Header row: the one that names the player column.
    let headerIndex = -1
    for (let i = 0; i < Math.min(rawRows.length, 12); i++) {
      if ((rawRows[i] ?? []).some((cell) => /اسم\s*اللاعب|full\s*name/i.test(cellText(cell)))) {
        headerIndex = i
        break
      }
    }
    if (headerIndex < 0) {
      return { athletes: [], error: "Could not find the header row (اسم اللاعب / Full Name). Please use the template." }
    }

    const head = rawRows[headerIndex] ?? []
    const headText = head.map(cellText).join(" ")
    const legacy = /full\s*name/i.test(headText) && /birth\s*year/i.test(headText)
    const next = rawRows[headerIndex + 1] ?? []
    const hasSubHeader = !legacy && next.some((cell) => /deep\s*squat|push\s*ups?|^R$|^L$|watt/i.test(cellText(cell)))
    const columns = detectColumns(head, hasSubHeader ? next : [], legacy)
    const firstDataRow = headerIndex + (hasSubHeader ? 2 : 1)

    // Sheet-wide date in the title row: "تاريخ: 15 / 1 / 2026"
    const titleText = rawRows.slice(0, headerIndex).flat().map(cellText).join(" ")
    const titleDate = /(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/.exec(titleText)
    const defaultDate = titleDate ? `${titleDate[3]}-${titleDate[2].padStart(2, "0")}-${titleDate[1].padStart(2, "0")}` : null

    const athletes: ParsedAthleteRow[] = []
    for (let r = firstDataRow; r < rawRows.length; r++) {
      const row = rawRows[r]
      if (!row || !row.length) continue

      const name = cellText(row[columns.name])
      if (!name || HEADER_WORDS.has(name.toLowerCase()) || /^\d+$/.test(name)) continue

      const at = (index: number) => (index >= 0 ? row[index] : null)
      const num = (index: number) => parseNumber(at(index))

      const fms = columns.fms.map((index) => num(index))
      const [deepSquat, hurdleStep, inlineLunge, shoulderMobility, legRaise, trunkStability, rotaryStability] = fms
      const fmsTotal = fms.every((score) => score != null) ? fms.reduce<number>((total, score) => total + (score ?? 0), 0) : null

      const person = transliterateName(name)
      const club = translateClub(cellText(at(columns.club)))

      athletes.push({
        rowNumber: r + 1,
        fullName: person.en ?? name,
        fullNameAr: person.ar,
        clubName: club?.en ?? "Not Set",
        clubNameAr: club?.ar ?? null,
        sport: translateSport(cellText(at(columns.sport))) ?? "Not Set",
        position: translatePosition(cellText(at(columns.position))) ?? "Not Set",
        birthYear: parseBirthYear(at(columns.birth)),
        assessmentDate: parseDate(at(columns.date)) ?? defaultDate,
        deepSquat,
        hurdleStep,
        inlineLunge,
        shoulderMobility,
        activeStraightLegRaise: legRaise,
        trunkStability,
        rotaryStability,
        fmsTotal,
        verticalJumpCm: num(columns.vJump),
        horizontalJumpCm: num(columns.hJump),
        sprint20mSec: num(columns.sprint20),
        tTestSec: num(columns.tTest),
        agility505RSec: num(columns.agilityR),
        agility505LSec: num(columns.agilityL),
        pushUps: num(columns.pushUps),
        pullUps: num(columns.pullUps),
        plankSec: num(columns.plank),
        beepTestLevel: num(columns.beep),
        rowMachineResult: num(columns.rowM),
        rowMachineWatts: num(columns.rowWatt),
        rawNotes: club ? `Imported from ${club.en} roster` : "Bulk Excel Import",
      })
    }

    return { athletes, error: null }
  } catch (err) {
    return { athletes: [], error: err instanceof Error ? err.message : "Failed to parse Excel workbook." }
  }
}

// ─── Template (same layout as Coach Ahmed's measurement sheet) ────────────────

export type ImportColumn = {
  /** Arabic label as it appears in the sheet header. */
  ar: string
  /** English label. */
  en: string
  required?: boolean
  hint: string
  hintAr: string
  example1: string | number
  example2: string | number
}

/** Columns in sheet order (column C, the continuation of the merged name cell, is not listed). */
export const IMPORT_COLUMNS: ImportColumn[] = [
  { ar: "م", en: "No.", hint: "Optional running number.", hintAr: "رقم تسلسلي اختياري.", example1: 1, example2: 2 },
  { ar: "اسم اللاعب", en: "Player name", required: true, hint: "Player's full name in Arabic or English. Arabic names are also saved in English when the words are known.", hintAr: "الاسم الكامل بالعربية أو الإنجليزية. تُحفظ الأسماء العربية بالإنجليزية أيضًا عند معرفة الكلمات.", example1: "محمد احمد", example2: "يوسف مصطفي" },
  { ar: "النادي", en: "Club", hint: "Club name (e.g. الأهلي). A team is created if it does not exist; Arabic clubs get an English name too.", hintAr: "اسم النادي (مثل الأهلي). يتم إنشاء الفريق إن لم يكن موجودًا.", example1: "الطيران", example2: "الجيش" },
  { ar: "اللعبة", en: "Sport", hint: "يد (handball), فولي (volleyball), هوكي (hockey), قدم, سلة, سباحة…", hintAr: "يد، فولي، هوكي، قدم، سلة، سباحة…", example1: "يد", example2: "هوكي" },
  { ar: "المركز", en: "Position", hint: "GK, RB, LB, RW, LW, CB or P (pivot), or the Arabic name.", hintAr: "GK أو RB أو LB أو RW أو LW أو CB أو P (دائرة)، أو الاسم بالعربية.", example1: "GK", example2: "RB" },
  { ar: "السن او مواليد", en: "Age or birth year", hint: "Birth year (2012) or age (14). Used to avoid duplicate athletes.", hintAr: "سنة الميلاد (2012) أو السن (14).", example1: 2012, example2: 2011 },
  { ar: "date", en: "Assessment date", hint: "Optional date of the measurements, e.g. 2026-01-15. If empty, the date written in the title row is used.", hintAr: "تاريخ القياسات (اختياري) مثل 2026-01-15. إن تُرك فارغًا يُستخدم التاريخ المكتوب في أعلى الورقة.", example1: "2026-01-15", example2: "2026-01-15" },
  { ar: "Deep Squat", en: "Deep Squat (FMS 0–3)", hint: "FMS score, whole number 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 3 },
  { ar: "Hurdle Step", en: "Hurdle Step (FMS 0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2 },
  { ar: "Inline Lunge", en: "Inline Lunge (FMS 0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2 },
  { ar: "Shoulder Mobility", en: "Shoulder Mobility (FMS 0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 3 },
  { ar: "Active Straight-Leg Raise", en: "Active Straight-Leg Raise (FMS 0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2 },
  { ar: "Trunk Stability Push-Up", en: "Trunk Stability Push-Up (FMS 0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2 },
  { ar: "Rotary Stability", en: "Rotary Stability (FMS 0–3)", hint: "FMS score 0–3.", hintAr: "درجة FMS من 0 إلى 3.", example1: 2, example2: 2 },
  { ar: "H Jumb", en: "Horizontal jump", hint: "Centimetres. “229-30” style values are read as the part after the dash.", hintAr: "بالسنتيمتر. القيمة بصيغة 229-30 تُقرأ كالرقم بعد الشرطة.", example1: 180, example2: 175 },
  { ar: "V Jumb", en: "Vertical jump", hint: "Centimetres. “229-30” (reach–jump) is read as 30.", hintAr: "بالسنتيمتر. القيمة 229-30 (الوصول–الوثب) تُقرأ 30.", example1: "229-30", example2: "225-27" },
  { ar: "Push Ups", en: "Push-ups", hint: "Repetitions.", hintAr: "عدد التكرارات.", example1: 15, example2: 10 },
  { ar: "Pull up", en: "Pull-ups", hint: "Repetitions.", hintAr: "عدد التكرارات.", example1: 5, example2: 3 },
  { ar: "Plank Hold", en: "Plank hold", hint: "Seconds.", hintAr: "بالثواني.", example1: 60, example2: 45 },
  { ar: "Level", en: "Beep test level", hint: "Level reached in the beep test.", hintAr: "المستوى الذي وصل إليه اللاعب في اختبار البيب.", example1: 8, example2: 7 },
  { ar: "Anaerobic 20m", en: "Anaerobic 20 m sprint", hint: "Seconds.", hintAr: "بالثواني.", example1: 4, example2: 4.4 },
  { ar: "R", en: "505 agility – right", hint: "Seconds, right leg.", hintAr: "بالثواني، الرجل اليمنى.", example1: 3.47, example2: 3.9 },
  { ar: "L", en: "505 agility – left", hint: "Seconds, left leg.", hintAr: "بالثواني، الرجل اليسرى.", example1: 3.5, example2: 3.5 },
  { ar: "T-Test تغيير اتجاة", en: "T-Test", hint: "Seconds.", hintAr: "بالثواني.", example1: 11.37, example2: 13.15 },
  { ar: "M", en: "Row machine – metres", hint: "Metres on the rowing machine.", hintAr: "المسافة بالمتر على جهاز التجديف.", example1: "", example2: "" },
  { ar: "Watt", en: "Row machine – watts", hint: "Power in watts.", hintAr: "القدرة بالوات.", example1: "", example2: "" },
]

const SHEET_WIDTHS = [5, 24, 4, 14, 10, 10, 14, 12, 12, 12, 12, 14, 14, 14, 14, 10, 10, 10, 10, 10, 10, 12, 8, 8, 12, 8, 8]

/** Header row of the sheet (row 3 in Excel). */
const HEADER_ROW: (string | null)[] = [
  "م", "اسم اللاعب", null, "النادي", "اللعبة", "المركز", "السن او مواليد", "date",
  "FMS Score 0 to 3     Total up to 14", null, null, null, null, null, null,
  "H Jumb", "V Jumb", "15–25", "8–11", "90 Sec", null, "Anaerobic 20m", "505 Agility Test 2.30 Sec", null, "T-Test تغيير اتجاة", "Row Mach. 8", null,
]
/** Sub-header row (row 4 in Excel). */
const SUB_HEADER_ROW: (string | null)[] = [
  null, null, null, null, null, null, null, null,
  "Deep Squat", "Hurdle Step", "Inline Lunge", "Shoulder Mobility", "Active Straight-Leg Raise", "Trunk Stability Push-Up", "Rotary Stability",
  null, null, "Push Ups", "Pull up", "Plank Hold", "Level", "2.5 Sec", "R", "L", " 12 Sec", "M", "Watt",
]

/** Maps an IMPORT_COLUMNS entry to its position in the 27-column sheet. */
const SHEET_POSITIONS = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]

/**
 * Rows of the first sheet: title + date, blank, header, sub-header, then (optionally) example players.
 * Identical in layout to Coach Ahmed's measurement sheet so his existing files import unchanged.
 */
export function buildTemplateSheetRows(withExamples: boolean): (string | number | null)[][] {
  const width = SHEET_WIDTHS.length
  const empty = () => Array<string | number | null>(width).fill(null)
  const title = empty()
  title[0] = "كشف قياسات"
  title[13] = `تاريخ:       /        /${new Date().getFullYear()}`
  const rows: (string | number | null)[][] = [title, empty(), [...HEADER_ROW], [...SUB_HEADER_ROW]]

  if (withExamples) {
    const make = (pick: (column: ImportColumn) => string | number) => {
      const row = empty()
      IMPORT_COLUMNS.forEach((column, i) => {
        const value = pick(column)
        row[SHEET_POSITIONS[i]] = value === "" ? null : value
      })
      return row
    }
    rows.push(make((c) => c.example1), make((c) => c.example2))
    // Only a name and club: every other column is optional.
    const minimal = empty()
    minimal[0] = 3
    minimal[1] = "احمد هاني"
    minimal[3] = "الشمس"
    minimal[4] = "يد"
    minimal[6] = 2013
    rows.push(minimal)
  }
  return rows
}

function styledSheet(rows: (string | number | null)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = SHEET_WIDTHS.map((wch) => ({ wch }))
  // Same merged cells as the original sheet: title, player name (B:C), FMS group, 505 group, Row Mach. group.
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 12 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
    { s: { r: 2, c: 8 }, e: { r: 2, c: 14 } },
    { s: { r: 2, c: 22 }, e: { r: 2, c: 23 } },
    { s: { r: 2, c: 25 }, e: { r: 2, c: 26 } },
  ]
  for (let r = 4; r < rows.length; r++) merges.push({ s: { r, c: 1 }, e: { r, c: 2 } })
  ws["!merges"] = merges
  return ws
}

/**
 * The workbook Coach Ahmed downloads:
 *   1. "Athletes"     — the empty sheet (title, headers, sub-headers). FILL THIS SHEET; it is the one that is imported.
 *   2. "Example"      — the same layout with three example players
 *   3. "Instructions" — bilingual explanation of every column
 */
export function generateAthleteImportTemplate(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, styledSheet(buildTemplateSheetRows(false)), "Athletes")
  XLSX.utils.book_append_sheet(wb, styledSheet(buildTemplateSheetRows(true)), "Example")

  const instructions = XLSX.utils.aoa_to_sheet([
    ["Troy Team — athlete roster import / استيراد قائمة اللاعبين"],
    [],
    ["1. Fill the first sheet (“Athletes”), one player per row under the headers. / املأ الورقة الأولى (Athletes)، لاعب في كل صف تحت العناوين."],
    ["2. Only the player name is required. Empty cells are saved as “Not Set”. / اسم اللاعب فقط مطلوب، والخلايا الفارغة تُترك غير محددة."],
    ["3. Keep the title row and the two header rows as they are. Your own measurement sheets in this layout import as they are. / لا تغيّر صفوف العناوين؛ ملفات القياسات بنفس هذا الشكل تُستورد كما هي."],
    ["4. Arabic words are converted to English automatically: sports (يد = handball), positions, clubs and common player names. / تُحوَّل الكلمات العربية إلى الإنجليزية تلقائيًا: الألعاب والمراكز والأندية والأسماء الشائعة."],
    ["5. Players who already exist (same name and birth year) are skipped. / اللاعبون الموجودون مسبقًا (نفس الاسم وسنة الميلاد) يتم تخطيهم."],
    ["6. After the import you get a Troy ID and a temporary password for each player. Save them! / ستحصل على رقم Troy وكلمة مرور مؤقتة لكل لاعب، احفظها."],
    [],
    ["Column / العمود", "Required / مطلوب", "What to enter", "ماذا تكتب"],
    ...IMPORT_COLUMNS.map((column) => [`${column.ar} / ${column.en}`, column.required ? "Yes / نعم" : "No / لا", column.hint, column.hintAr]),
  ])
  instructions["!cols"] = [{ wch: 52 }, { wch: 16 }, { wch: 70 }, { wch: 46 }]
  XLSX.utils.book_append_sheet(wb, instructions, "Instructions")

  return XLSX.write(wb, { type: "array", bookType: "xlsx" })
}
