import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { arabic } from "@/lib/i18n/ar-translations"
import { translate } from "@/lib/i18n/translate"

/**
 * Keeps the Arabic site complete: every t('…') / t.plural(…) string used anywhere in the source must have an entry
 * in lib/i18n/ar/*.ts, and every translation must keep the same {placeholders} as its English text.
 */

const ROOT = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

function usedStrings(): Map<string, string> {
  const used = new Map<string, string>()
  const single = /\b(?:t|tx)\(\s*("(?:\\.|[^"\\])*")/g
  const plural = /\bt\.plural\(\s*[^,]+,\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")/g
  for (const dir of ["app", "components", "lib"]) {
    for (const file of walk(path.join(ROOT, dir))) {
      const text = fs.readFileSync(file, "utf8")
      const rel = path.relative(ROOT, file)
      for (const regex of [single, plural]) {
        regex.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = regex.exec(text))) {
          for (const literal of match.slice(1)) {
            try {
              const value = JSON.parse(literal) as string
              if (!used.has(value)) used.set(value, rel)
            } catch {
              // not a plain string literal
            }
          }
        }
      }
    }
  }
  return used
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe("Arabic translations", () => {
  it("cover every string passed to t()", () => {
    const missing = [...usedStrings()].filter(([text]) => !(text in arabic)).map(([text, file]) => `${file}: ${text}`)
    expect(missing).toEqual([])
  })

  it("keep the same placeholders as the English text", () => {
    const broken = Object.entries(arabic)
      .filter(([english, ar]) => placeholders(english).join() !== placeholders(ar).join())
      .map(([english]) => english)
    expect(broken).toEqual([])
  })

  it("contain Arabic letters (not an untouched copy), except brand/symbol-only strings", () => {
    const untouched = Object.entries(arabic)
      .filter(([english, ar]) => !/[\u0600-\u06ff]/.test(ar) && /[A-Za-z]{3,}/.test(english.replace(/\{\w+\}/g, "")) && english === ar)
      .map(([english]) => english)
      // allowed: URLs, the language name, and similar strings that are intentionally identical
      .filter((english) => !/^(https?:|English$)/.test(english) && !/(RPE|FMS)/.test(english))
    expect(untouched).toEqual([])
  })
})

describe("translate()", () => {
  it("returns the English text and fills placeholders", () => {
    expect(translate("en", "Save")).toBe("Save")
    expect(translate("en", "Imported {count} athletes", { count: 3 })).toBe("Imported 3 athletes")
  })

  it("uses Arabic when available and falls back to English when missing", () => {
    expect(translate("ar", "Save")).toBe(arabic["Save"])
    expect(translate("ar", "Welcome, {name}", { name: "Ali" })).toContain("Ali")
    expect(translate("ar", "A sentence nobody translated")).toBe("A sentence nobody translated")
  })

  it("leaves unknown placeholders untouched", () => {
    expect(translate("en", "Hello {name}", {})).toBe("Hello {name}")
  })
})
