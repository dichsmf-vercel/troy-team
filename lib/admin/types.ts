/**
 * Row shapes delivered to the admin screens by app/admin/page.tsx.
 * Every column except `id` is optional because the page selects different columns per query.
 */

export type RelationOne<T> = T | T[] | null

export type AdminTeam = {
  id: string
  name_en: string
  name_ar?: string | null
  color_hex?: string | null
  image_url?: string | null
  is_national_team?: boolean | null
}

export type AdminExercise = {
  id: string
  name_en: string
  name_ar?: string | null
  category?: string | null
  image_url?: string | null
  video_youtube_url?: string | null
  default_sets?: number | null
  default_reps?: string | number | null
  exercise_code?: string | null
  movement_pattern?: string | null
  difficulty?: string | number | null
}

export type AdminRule = {
  id: string
  name?: string | null
  rule_type?: string | null
  condition_json?: { metric?: string; operator?: string; threshold?: string; attribute?: string; value?: string } | null
  action_json?: { action?: string; exercise_id?: string; original_exercise_id?: string | null; replacement_exercise_id?: string | null; injected_exercise_ids?: string[] } | null
  is_active?: boolean | null
  created_at?: string | null
}

export type AdminProgram = {
  id: string
  athlete_id?: string | null
  status?: string | null
  month_start?: string | null
  month_end?: string | null
  generation_reason?: unknown
  athletes?: RelationOne<{ profiles?: RelationOne<{ full_name?: string | null }> }>
  name_en?: string | null
  name_ar?: string | null
  description_en?: string | null
  description_ar?: string | null
  created_at?: string | null
}

export type AdminSession = {
  id: string
  title_en?: string | null
  title_ar?: string | null
  notes?: string | null
  session_date?: string | null
  start_time?: string | null
  team_id?: string | null
  athlete_id?: string | null
  teams?: RelationOne<{ name_en?: string | null; name_ar?: string | null }>
}

export type AdminNotification = {
  id: string
  title?: string | null
  body?: string | null
  is_read?: boolean | null
  created_at?: string | null
}

export type AdminSelfie = {
  id: string
  athlete_id: string
  storage_path?: string
  uploaded_at: string
  image_url: string | null
  selfie_type: "program" | "session"
  [column: string]: unknown
}

export type AdminAthleteProfile = {
  id: string
  full_name?: string | null
  full_name_ar?: string | null
  role?: string | null
  subscription_tier?: string | null
  renewal_date?: string | null
  coach_private_notes?: string | null
  troy_id?: string | null
  password_change_required?: boolean | null
}

export type AdminAthlete = {
  id: string
  /** Legacy fallback; the name normally lives in `profiles`. */
  full_name?: string | null
  tier?: string | null
  account_status?: string | null
  assessment_status?: string | null
  medical_clearance_status?: string | null
  intake_completed_at?: string | null
  phone?: string | null
  height_cm?: number | null
  weight_kg?: number | null
  injury_notes?: string | null
  goals?: string | null
  created_at?: string | null
  sport?: string | null
  position?: string | null
  birth_year?: number | null
  free_training_days?: number[] | null
  show_exercise_recap?: boolean | null
  athlete_teams?: { athlete_id?: string; team_id?: string; teams?: RelationOne<AdminTeam> }[]
  profiles?: AdminAthleteProfile | null
  auth_email?: string
  latest_measurement?: { height_cm?: number | null; weight_kg?: number | null; recorded_at?: string | null } | null
  latest_inbody?: { height_cm?: number | null; weight_kg?: number | null; recorded_at?: string | null } | null
  latest_assessment?: { id: string; submitted_at?: string | null; status?: string | null; assessment_photo_path?: string | null } | null
  assessment_answers?: { assessment_id: string; question_key: string; answer_json?: { value?: number | string | null } | null }[]
}
