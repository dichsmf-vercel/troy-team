export type AppRole = "admin" | "supporting_coach" | "athlete"
export type LanguagePref = "en" | "ar"
export type AthleteTier = "beginner" | "intermediate" | "advanced" | "elite"
export type Team = {
  id: string
  name_en: string
  name_ar: string
  color_hex: string
  image_url: string | null
  is_national_team: boolean
  created_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  role: AppRole
  language_preference: LanguagePref
  profile_picture_url: string | null
  created_at: string
  updated_at: string
}

export type Athlete = {
  id: string
  age: number | null
  phone: string | null
  weight_kg: number | null
  height_cm: number | null
  tier: AthleteTier
  injury_notes: string | null
  goals: string | null
  intake_completed_at: string | null
  created_at: string
  updated_at: string
}

export type Exercise = {
  id: string
  name_en: string
  name_ar: string
  description_en: string | null
  description_ar: string | null
  category: string | null
  image_url: string | null
  video_youtube_url: string | null
  default_sets: number | null
  default_reps: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SessionPost = {
  id: string
  team_id: string | null
  athlete_id: string | null
  title_en: string
  title_ar: string
  notes: string | null
  session_date: string
  start_time: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SessionExercise = {
  id: string
  session_post_id: string
  exercise_id: string
  exercise_order: number
  sets: number | null
  reps: string | null
  created_at: string
}

export type SessionAthlete = {
  id: string
  session_post_id: string
  athlete_id: string
  attended_at: string | null
  gps_latitude: number | null
  gps_longitude: number | null
  status: string
  created_at: string
}

export type ExerciseCompletion = {
  id: string
  session_athlete_id: string
  session_exercise_id: string
  completed: boolean
  completed_at: string | null
  pain_reported: boolean
  pain_location: string | null
  pain_severity: number | null
  pain_notes: string | null
  created_at: string
}

export type SessionSummary = {
  id: string
  session_athlete_id: string
  rpe: number | null
  overall_rating: number | null
  sleep_quality: number | null
  soreness_level: number | null
  symptoms: string[] | null
  feedback_text: string | null
  submitted_at: string
}

export type SessionSelfie = {
  id: string
  session_athlete_id: string
  image_url: string | null
  justification: string | null
  uploaded_at: string
  reviewed: boolean
  reviewed_by: string | null
  reviewed_at: string | null
}

export type Measurement = {
  id: string
  athlete_id: string
  recorded_at: string
  weight_kg: number | null
  height_cm: number | null
  body_fat_pct: number | null
  notes: string | null
}
