/**
 * Gemini AI integration for program generation.
 *
 * GEMINI_API_KEY_1 — used for full program generation
 * GEMINI_API_KEY_2 — used for summarization / prompt learning after admin edits
 *
 * Both use Gemini 2.0 Flash via the REST API (no SDK needed, keeps bundle size zero).
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

type GeminiContent = { role: "user" | "model"; parts: { text: string }[] }

async function callGemini(apiKey: string, prompt: string, systemInstruction?: string): Promise<string> {
  const candidateModels = [
    process.env.GEMINI_MODEL,
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-pro-latest",
  ].filter(Boolean) as string[]

  // Deduplicate and filter out deprecated/discontinued models for new users
  const uniqueModels = [...new Set(candidateModels)].filter(
    (m) => m !== "gemini-2.5-flash" && m !== "gemini-2.0-flash"
  )

  const failureLog: string[] = []

  for (let i = 0; i < uniqueModels.length; i++) {
    const model = uniqueModels[i]
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: prompt }] }] as GeminiContent[],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    }
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] }
    }

    try {
      console.log(`[Gemini] Attempting generation with model (${i + 1}/${uniqueModels.length}): ${model}`)
      const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        let msg = text
        try {
          const errJson = JSON.parse(text)
          msg = errJson?.error?.message || text
        } catch {
          // ignore parse error
        }

        const isAuthError = res.status === 401 || res.status === 403
        if (isAuthError) {
          // Key itself is unauthorized or suspended
          throw new Error(`Gemini API error ${res.status}: ${msg}`)
        }

        failureLog.push(`${model} (HTTP ${res.status})`)

        if (i < uniqueModels.length - 1) {
          console.warn(`[Gemini] Model ${model} returned HTTP ${res.status} ("${msg.slice(0, 100)}"). Iterating to next candidate: ${uniqueModels[i + 1]}...`)
          continue
        }

        throw new Error(`All candidate models failed: ${failureLog.join(", ")} | Last error: ${msg}`)
      }

      const json = await res.json()
      const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
      if (!text) {
        failureLog.push(`${model} (empty response)`)
        if (i < uniqueModels.length - 1) continue
        throw new Error("Gemini returned an empty response.")
      }

      console.log(`[Gemini] Successfully generated output using model: ${model}`)
      return text
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("401") || msg.includes("403") || msg.includes("suspended")) {
        throw err
      }

      failureLog.push(`${model} (error)`)
      if (i < uniqueModels.length - 1) {
        console.warn(`[Gemini] Error with model ${model} (${msg.slice(0, 100)}). Trying ${uniqueModels[i + 1]}...`)
        continue
      }
      throw new Error(`All candidate models failed: ${failureLog.join(", ")} | ${msg}`)
    }
  }

  throw new Error(`No models could be contacted. Tried: ${uniqueModels.join(", ")}`)
}

/** Extract JSON from a Gemini response that may include markdown code fences. */
function extractJson(text: string): unknown {
  // Try to find a ```json ... ``` block first
  const fenceMatch = /```(?:json)?\s*([\s\S]+?)\s*```/i.exec(text)
  const raw = fenceMatch ? fenceMatch[1] : text.trim()
  return JSON.parse(raw)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type GeminiExercise = {
  id?: string
  name_en: string
  section: string
  sets: number
  reps: string
  tempo?: string | null
  load_percentage?: number | null
  notes?: string | null
  image_url?: string | null
}

export type GeminiSession = {
  date: string
  time: string
  week: number
  exercises: GeminiExercise[]
}

export type GeminiProgramOutput = {
  goal: string
  rationale: string
  warnings: string[]
  sessions: GeminiSession[]
}

// ─── Program generation ───────────────────────────────────────────────────────

export async function generateProgramWithGemini(input: {
  athlete: {
    name: string
    sport: string | null
    position: string | null
    birth_year: number | null
    height_cm: number | null
    weight_kg: number | null
    injury_notes: string | null
    tier: string | null
  }
  assessmentAnswers: Record<string, number | null>
  exercises: { id: string; name_en: string; category: string | null; image_url: string | null }[]
  startDate: string
  time: string
  weekdays: number[]
  coachSystemPrompt?: string | null
}): Promise<{ data: GeminiProgramOutput | null; error: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY_1
  if (!apiKey) return { data: null, error: "GEMINI_API_KEY_1 is not configured." }

  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const trainingDays = input.weekdays.map((d) => weekdayNames[d]).join(", ")
  const age = input.athlete.birth_year ? new Date().getFullYear() - input.athlete.birth_year : null

  // Build the exercise list for the prompt (give Gemini the IDs so it can use them)
  const exerciseList = input.exercises
    .map((e) => `- ${e.name_en} (id: ${e.id}, category: ${e.category ?? "general"})`)
    .join("\n")

  // Serialize assessment answers into readable text
  const assessmentText = Object.entries(input.assessmentAnswers)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n")

  const systemPrompt = input.coachSystemPrompt ?? `You are an expert strength and conditioning coach for Egyptian athletes. 
You specialize in sport-specific training for handball, football, basketball, volleyball, and hockey.
Design evidence-based, periodized programs that are safe, progressive, and respect the athlete's limitations.
Always produce valid JSON with no extra commentary outside the JSON block.`

  const userPrompt = `Design a 4-week training program for the following athlete and return ONLY a JSON object.

## Athlete profile
Name: ${input.athlete.name}
Age: ${age ?? "unknown"}
Sport: ${input.athlete.sport ?? "general fitness"}
Position: ${input.athlete.position ?? "not specified"}
Height: ${input.athlete.height_cm ? input.athlete.height_cm + " cm" : "unknown"}
Weight: ${input.athlete.weight_kg ? input.athlete.weight_kg + " kg" : "unknown"}
Tier: ${input.athlete.tier ?? "standard"}
Injury notes: ${input.athlete.injury_notes ?? "none"}

## Assessment scores
${assessmentText || "No assessment data available — design a conservative baseline program."}

## Training schedule
Start date: ${input.startDate}
Training days each week: ${trainingDays} (${input.weekdays.length} days/week)
Session time: ${input.time}

## Available exercises
${exerciseList}

## Instructions
1. Create ${input.weekdays.length} sessions per week for 4 weeks (${input.weekdays.length * 4} sessions total).
2. Each session must include exercises from these sections in order: Warm-up, Mobility, Strength/Power, Accessory, Cooldown.
3. Use ONLY exercises from the "Available exercises" list above. Include the exercise id in your output.
4. For each exercise provide: sets (integer), reps (string like "8" or "8-12" or "30 sec"), tempo (optional, e.g. "3-1-2"), load_percentage (null for bodyweight/mobility), notes (optional coaching cue).
5. Progress load across the 4 weeks (e.g. 60% → 70% → 80% → 85% for strength exercises).
6. Derive a short training goal for this athlete based on their profile.
7. Write a brief rationale paragraph (2-3 sentences) explaining the program design.
8. List any safety warnings or contraindications based on injury notes and assessment scores.
9. Each session must have: date (YYYY-MM-DD format, first training day of the week starting from ${input.startDate}), time (${input.time}), week (1–4), exercises array.

## Required JSON format
\`\`\`json
{
  "goal": "short training goal label",
  "rationale": "2-3 sentence explanation of program design",
  "warnings": ["warning 1 if any", "warning 2 if any"],
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "time": "${input.time}",
      "week": 1,
      "exercises": [
        {
          "id": "exercise-uuid-from-list",
          "name_en": "Exercise Name",
          "section": "Warm-up",
          "sets": 2,
          "reps": "10",
          "tempo": null,
          "load_percentage": null,
          "notes": null,
          "image_url": null
        }
      ]
    }
  ]
}
\`\`\`

Return ONLY the JSON block above. No explanatory text before or after.`

  try {
    const raw = await callGemini(apiKey, userPrompt, systemPrompt)
    const parsed = extractJson(raw) as GeminiProgramOutput

    // Validate structure
    if (!parsed?.sessions?.length) {
      return { data: null, error: "Gemini returned an invalid program structure — sessions array is empty." }
    }

    // Enrich exercise image_url from our exercise list where Gemini left it null
    const exerciseById = new Map(input.exercises.map((e) => [e.id, e]))
    const enriched: GeminiProgramOutput = {
      ...parsed,
      sessions: parsed.sessions.map((session) => ({
        ...session,
        exercises: session.exercises.map((ex) => ({
          ...ex,
          image_url: ex.image_url ?? exerciseById.get(ex.id ?? "")?.image_url ?? null,
        })),
      })),
    }

    return { data: enriched, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: null, error: msg }
  }
}

// ─── Prompt learning (summarization after admin edits) ────────────────────────

export async function summarizeAdminEdits(input: {
  originalProgram: GeminiProgramOutput
  editedProgram: GeminiProgramOutput
  adminReason: string
  athleteName: string
  currentPromptText: string
}): Promise<{ summary: string | null; newPromptText: string | null; error: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY_2
  if (!apiKey) return { summary: null, newPromptText: null, error: "GEMINI_API_KEY_2 is not configured." }

  // Build a diff summary between the two programs
  const origExerciseNames = input.originalProgram.sessions.flatMap((s) => s.exercises.map((e) => e.name_en))
  const editExerciseNames = input.editedProgram.sessions.flatMap((s) => s.exercises.map((e) => e.name_en))
  const removed = origExerciseNames.filter((n) => !editExerciseNames.includes(n))
  const added = editExerciseNames.filter((n) => !origExerciseNames.includes(n))

  const prompt = `A coach reviewed an AI-generated 4-week training program for athlete "${input.athleteName}" and made the following edits:

## Changes made
- Exercises removed: ${removed.length ? removed.join(", ") : "none"}
- Exercises added: ${added.length ? added.join(", ") : "none"}
- Original goal: ${input.originalProgram.goal}
- New goal: ${input.editedProgram.goal}

## Coach's reason for changes
"${input.adminReason}"

## Current coach system prompt
${input.currentPromptText}

## Task
1. Write a 2-3 sentence summary of what was changed and why.
2. Update the coach system prompt to incorporate the preferences and patterns revealed by these edits. Keep the updated prompt concise (under 400 words). Preserve the original structure and intent; only add or refine based on the edits.

Return ONLY a JSON object:
\`\`\`json
{
  "summary": "...",
  "updatedPrompt": "..."
}
\`\`\`
`

  try {
    const raw = await callGemini(apiKey, prompt)
    const parsed = extractJson(raw) as { summary: string; updatedPrompt: string }
    return { summary: parsed.summary, newPromptText: parsed.updatedPrompt, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { summary: null, newPromptText: null, error: msg }
  }
}
