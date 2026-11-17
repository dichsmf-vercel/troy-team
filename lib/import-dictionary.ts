/**
 * Arabic → English mapping for roster imports (sports, positions, clubs, player names).
 * Built from Coach Ahmed's measurement sheets; extend the tables below when a new word shows up.
 * Lookups ignore diacritics, alef/ya/ta-marbuta spelling variants and the leading "ال".
 */

/** Normalises Arabic for comparison: no diacritics/tatweel, أإآ→ا, ى→ي, ة→ه, single spaces. */
export function normalizeArabic(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

const stripArticle = (key: string) => key.replace(/^ال(?=\S)/, "")
const isArabic = (value: string) => /[؀-ۿ]/.test(value)

// ─── Sports ───────────────────────────────────────────────────────────────────

const SPORTS: Record<string, string> = {
  يد: "handball",
  "كره يد": "handball",
  handball: "handball",
  فولي: "volleyball",
  طايره: "volleyball",
  "كره طايره": "volleyball",
  "كره طائره": "volleyball",
  طائره: "volleyball",
  volleyball: "volleyball",
  هوكي: "hockey",
  hockey: "hockey",
  قدم: "football",
  "كره قدم": "football",
  football: "football",
  soccer: "football",
  سله: "basketball",
  "كره سله": "basketball",
  basketball: "basketball",
  سباحه: "swimming",
  swimming: "swimming",
  "العاب قوي": "athletics",
  "العاب قوى": "athletics",
  athletics: "athletics",
}

export function translateSport(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim()
  if (!text) return null
  const key = normalizeArabic(text)
  return SPORTS[key] ?? SPORTS[stripArticle(key)] ?? text.toLowerCase()
}

// ─── Positions ────────────────────────────────────────────────────────────────

const POSITIONS: Record<string, string> = {
  gk: "GK",
  حارس: "GK",
  "حارس مرمي": "GK",
  rb: "RB",
  "ظهير ايمن": "RB",
  lb: "LB",
  "ظهير ايسر": "LB",
  rw: "RW",
  "جناح ايمن": "RW",
  lw: "LW",
  "جناح ايسر": "LW",
  cb: "CB",
  "لاعب وسط": "CB",
  "مفتاح لعب": "CB",
  وسط: "CB",
  playmaker: "CB",
  p: "Pivot",
  pivot: "Pivot",
  دائره: "Pivot",
  بيفوت: "Pivot",
  st: "Forward",
  مهاجم: "Forward",
  df: "Defender",
  مدافع: "Defender",
  mf: "Midfielder",
}

export function translatePosition(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim()
  if (!text) return null
  return POSITIONS[normalizeArabic(text)] ?? text
}

// ─── Clubs ────────────────────────────────────────────────────────────────────

/** [canonical Arabic, English]. Matched without the leading "ال" so "طيران" and "الطيران" are the same club. */
const CLUBS: [string, string][] = [
  ["الطيران", "Al Tayaran"],
  ["الجيش", "Al Gaish (Army)"],
  ["الشمس", "Al Shams"],
  ["اكتوبر", "October"],
  ["المقاولين", "Al Mokawloon"],
  ["الشرطة", "Al Shorta (Police)"],
  ["الزمالك", "Zamalek"],
  ["النصر", "Al Nasr"],
  ["الزهور", "Al Zohour"],
  ["دبي", "Dubai"],
  ["الاهلي", "Al Ahly"],
  ["هوليدو", "Holido"],
  ["الداخلية", "Al Dakhleya (Interior)"],
  ["الدخلية", "Al Dakhleya (Interior)"],
  ["سبورتنج", "Sporting"],
  ["الاتحاد", "Al Ittihad"],
  ["الاسماعيلي", "Ismaily"],
  ["المصري", "Al Masry"],
  ["بيراميدز", "Pyramids"],
  ["الجزيرة", "Al Gezira"],
  ["المعادي", "Maadi"],
  ["وادي دجلة", "Wadi Degla"],
  ["سموحة", "Smouha"],
  ["الترسانة", "Tersana"],
  ["هليوبوليس", "Heliopolis"],
  ["السكه الحديد", "Al Sekka Al Hadid"],
]

const CLUB_INDEX = new Map(CLUBS.map(([ar, en]) => [stripArticle(normalizeArabic(ar)), { ar, en }]))

/** Key that makes "الطيران", "طيران " and "Al Tayaran" collapse to the same club. */
export function clubKey(value: string): string {
  const key = normalizeArabic(value)
  const known = CLUB_INDEX.get(stripArticle(key))
  if (known) return normalizeArabic(known.en).replace(/^al /, "")
  return stripArticle(key).replace(/^al /, "")
}

export function translateClub(raw: string | null | undefined): { en: string; ar: string | null } | null {
  const text = (raw ?? "").trim()
  if (!text || text.toLowerCase() === "not set") return null
  const known = CLUB_INDEX.get(stripArticle(normalizeArabic(text)))
  if (known) return { en: known.en, ar: known.ar }
  return isArabic(text) ? { en: text, ar: text } : { en: text, ar: null }
}

// ─── Player names ─────────────────────────────────────────────────────────────

const NAMES: Record<string, string> = {
  احمد: "Ahmed", محمد: "Mohamed", يوسف: "Youssef", مالك: "Malek", ياسين: "Yassin", عمر: "Omar", مصطفي: "Mostafa",
  هاني: "Hany", رامي: "Ramy", عادل: "Adel", سيد: "Sayed", عبدالله: "Abdullah", خالد: "Khaled", عصام: "Essam",
  زياد: "Ziad", اسامه: "Osama", علي: "Ali", ريتاج: "Ritaj", عبدالحميد: "Abdelhamid", علاء: "Alaa", زين: "Zein",
  اشرف: "Ashraf", مروان: "Marwan", سيف: "Seif", وائل: "Wael", لي: "Lee", هنا: "Hana", الدين: "El-Din", هايا: "Haya",
  جودي: "Judy", سامح: "Sameh", تايسون: "Tyson", تامر: "Tamer", الورداني: "El-Wardany", يحي: "Yehia", يحيي: "Yehia",
  ريتال: "Rital", مريم: "Mariam", احلام: "Ahlam", براء: "Baraa", عمرو: "Amr", الجندي: "El-Gendy", كرم: "Karam",
  الليثي: "El-Leithy", حازم: "Hazem", جوفاني: "Giovanni", حلا: "Hala", ليلي: "Laila", عفيفي: "Afifi", ادهم: "Adham",
  رمضان: "Ramadan", تيم: "Tim", تقي: "Taqi", اياد: "Iyad", طارق: "Tarek", فريده: "Farida", لارا: "Lara", جاسمين: "Jasmine",
  مهند: "Mohannad", جوري: "Jory", مايا: "Maya", شذا: "Shaza", حسام: "Hossam", ملك: "Malak", نور: "Nour", عزت: "Ezzat",
  بانوبي: "Panoby", هلا: "Hala", ابراهيم: "Ibrahim", زوربا: "Zorba", انس: "Anas", كريم: "Karim", حاتم: "Hatem",
  متولي: "Metwally", هشام: "Hisham", رغد: "Raghad", سولي: "Soli", لوجين: "Logain", كارما: "Karma", منه: "Menna",
  ابو: "Abou", العله: "El-Ela", هيثم: "Haitham", خديجه: "Khadiga", سندس: "Sondos", معاذ: "Moaz", ايمن: "Ayman",
  // common extras
  اسماعيل: "Ismail", ايهاب: "Ehab", باسم: "Bassem", بسمه: "Basma", حسن: "Hassan", حسين: "Hussein", حمزه: "Hamza",
  خليل: "Khalil", دينا: "Dina", رنا: "Rana", رودينا: "Rodina", سلمي: "Salma", سعيد: "Said", شهد: "Shahd", صلاح: "Salah",
  طه: "Taha", عبدالرحمن: "Abdelrahman", عبدالعزيز: "Abdelaziz", عثمان: "Osman", عماد: "Emad", عمار: "Ammar",
  فارس: "Fares", فاطمه: "Fatma", فتحي: "Fathy", ماجد: "Maged", محمود: "Mahmoud", مؤمن: "Moemen", ميار: "Mayar",
  ناصر: "Nasser", نبيل: "Nabil", نسمه: "Nesma", هبه: "Heba", هدي: "Hoda", هند: "Hend", ياسر: "Yasser", يارا: "Yara",
  يمني: "Yomna", ندي: "Nada", نادين: "Nadine", رحمه: "Rahma", روان: "Rawan", ساره: "Sara", سلمه: "Salma", سلمان: "Salman",
  شريف: "Sherif", شادي: "Shady", عبير: "Abeer", علياء: "Alia", غاده: "Ghada", فرح: "Farah", كنزي: "Kenzy", لينا: "Lina",
  مازن: "Mazen", مجدي: "Magdy", مدحت: "Medhat", مراد: "Mourad", منصور: "Mansour", مهدي: "Mahdy", نادر: "Nader",
  هادي: "Hadi", وليد: "Walid", ياسمين: "Yasmin", يزن: "Yazan", زهره: "Zahra", تميم: "Tamim",
  جاد: "Gad", جهاد: "Gehad", حبيبه: "Habiba", حنان: "Hanan", خالدي: "Khaldi", دعاء: "Doaa", رزان: "Razan", زينه: "Zeina",
  سامي: "Sami", سليم: "Selim", سمير: "Samir", سهيل: "Soheil", صباح: "Sabah", عاصم: "Asem", عبده: "Abdou", عزيز: "Aziz",
  عطيه: "Attia", فؤاد: "Fouad", قاسم: "Kassem", لؤي: "Loay", مجد: "Magd", مرام: "Maram", منير: "Mounir",
  نجيب: "Naguib", نهي: "Noha", هاجر: "Hagar", هيا: "Haya", وسام: "Wesam",
}

export function transliterateName(raw: string | null | undefined): { en: string | null; ar: string | null } {
  const original = (raw ?? "").replace(/\s+/g, " ").trim()
  if (!original) return { en: null, ar: null }
  if (!isArabic(original)) return { en: original, ar: null }

  const words = original.split(" ")
  const translated: string[] = []
  for (const word of words) {
    const english = NAMES[normalizeArabic(word)]
    if (!english) return { en: null, ar: original }
    translated.push(english)
  }
  return { en: translated.join(" "), ar: original }
}
