// Generates modest, photo-style exercise images with Gemini (start + end position, same man).
// Needs GEMINI_API_KEY_1 (or GEMINI_API_KEY) in .env.local. Writes PNGs to scripts/exercise-images/out/
// for review; nothing in the app changes until the chosen images are copied into public/.
//
//   node scripts/exercise-images/generate.mjs              # all exercises that use an illustration
//   node scripts/exercise-images/generate.mjs E001 E012    # only these codes (e.g. to redo a bad one)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const env = existsSync(join(root, ".env.local"))
  ? Object.fromEntries(readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]))
  : {}
const KEY = process.env.GEMINI_API_KEY_1 ?? env.GEMINI_API_KEY_1 ?? process.env.GEMINI_API_KEY ?? env.GEMINI_API_KEY
if (!KEY) throw new Error("Set GEMINI_API_KEY_1 in .env.local first.")
const API = "https://generativelanguage.googleapis.com/v1beta"

// Pick the newest model that can return images (names change between Gemini releases).
async function imageModel() {
  if (process.env.IMAGE_MODEL) return process.env.IMAGE_MODEL
  const res = await fetch(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": KEY } })
  const { models = [] } = await res.json()
  const names = models.filter((m) => /image/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m) => m.name.replace("models/", ""))
  if (!names.length) throw new Error("No image-capable Gemini model is available for this key.")
  return names.sort().reverse()[0]
}

const lib = readFileSync(join(root, "lib", "exercise-library.ts"), "utf8")
const all = [...lib.matchAll(/code: "(E\d{3})", name: "([^"]+)".*?images: \["\/exercises\/illustrations\//g)].map((m) => ({ code: m[1], name: m[2] }))
const only = process.argv.slice(2)
const todo = only.length ? all.filter((e) => only.includes(e.code)) : all

const prompt = (name) => `Photorealistic fitness instruction photo, two panels side by side in one image, same person in both:
LEFT panel = the START position, RIGHT panel = the END position of the exercise "${name}", performed with correct, safe technique as a strength coach would teach it.
The athlete is an adult man with a modest appearance, wearing a loose long-sleeved athletic top and loose full-length track pants that cover the legs down to the ankles, plus training shoes. Nothing above the knee is exposed, he is never shirtless, no tight or revealing clothing.
Only this one man in the picture, no women, no other people. Plain bright gym or studio background, full body visible, side or three-quarter view that shows the joint angles clearly, the right equipment for the exercise.
No text, no labels, no arrows, no watermark.`

const out = join(root, "scripts", "exercise-images", "out")
mkdirSync(out, { recursive: true })
const model = await imageModel()
console.log("model:", model, "| exercises:", todo.length)
for (const { code, name } of todo) {
  const file = join(out, `${code}.png`)
  if (existsSync(file) && !only.length) { console.log(code, "exists, skipped"); continue }
  const res = await fetch(`${API}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt(name) }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } } }),
  })
  const data = await res.json()
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
  if (!part) { console.log(code, "FAILED:", JSON.stringify(data.error ?? data.promptFeedback ?? data).slice(0, 200)); continue }
  writeFileSync(file, Buffer.from(part.inlineData.data, "base64"))
  console.log(code, name, "ok")
}
