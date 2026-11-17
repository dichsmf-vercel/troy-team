/**
 * Minimal RFC-4180 style CSV parser: quoted fields, escaped quotes (""), commas and
 * newlines inside quotes, CRLF/LF line endings, optional BOM.
 */
export function parseCsvRows(csv: string): string[][] {
  const text = csv.replace(/^﻿/, "")
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') inQuotes = true
    else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""))
}

/** Parses a CSV with a header row into objects keyed by trimmed header name. */
export function parseCsvObjects(csv: string): Record<string, string>[] {
  const [header, ...body] = parseCsvRows(csv)
  if (!header) return []
  const keys = header.map((cell) => cell.trim())
  return body.map((cells) => Object.fromEntries(keys.map((key, index) => [key, (cells[index] ?? "").trim()])))
}
