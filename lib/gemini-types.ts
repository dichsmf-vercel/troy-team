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

export type CatalogExercise = {
  id: string
  name_en: string
  category: string | null
  image_url: string | null
}
