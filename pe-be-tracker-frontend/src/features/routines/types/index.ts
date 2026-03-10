export interface IntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

export interface ExerciseType {
  id: number;
  name: string;
  description?: string | null;
  default_intensity_unit: number;
  times_used: number;
}

export interface SetTemplate {
  id: number;
  reps?: number | null;
  intensity?: number | null;
  intensity_unit_id: number;
  created_at: string;
  updated_at: string;
  intensity_unit?: IntensityUnit;
}

export interface ExerciseTemplate {
  id: number;
  exercise_type_id: number;
  created_at: string;
  updated_at: string;
  exercise_type?: ExerciseType;
  set_templates: SetTemplate[];
}

export interface Routine {
  id: number;
  name: string;
  description?: string | null;
  workout_type_id: number;
  creator_id: number;
  created_at: string;
  updated_at: string;
  exercise_templates: ExerciseTemplate[];
}
