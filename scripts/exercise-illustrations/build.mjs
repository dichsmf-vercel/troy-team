// Generates the start/end illustrations in public/exercises/illustrations and a preview page.
// Run: node scripts/exercise-illustrations/build.mjs
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { render } from "./figure.mjs"
import { EXERCISES } from "./poses.mjs"

const out = join(process.cwd(), "public", "exercises", "illustrations")
mkdirSync(out, { recursive: true })
let preview = "<!doctype html><meta charset=utf-8><style>body{font:12px sans-serif;display:flex;flex-wrap:wrap;gap:6px}div{border:1px solid #ddd;width:306px}svg{width:150px;height:125px}b{font-size:13px}</style>"
for (const [code, poses] of Object.entries(EXERCISES)) {
  preview += `<div><b>${code}</b><br>`
  poses.forEach((p, i) => {
    const svg = render(p)
    writeFileSync(join(out, `${code}-${i}.svg`), svg)
    preview += svg
  })
  preview += "</div>"
}
if (process.argv[2]) writeFileSync(process.argv[2], preview)
console.log(Object.keys(EXERCISES).length, "exercises")
