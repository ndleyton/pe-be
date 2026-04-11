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
  duration_seconds?: number | null;
  intensity?: number | null;
  rpe?: number | null;
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
  notes?: string | null;
}

export type RoutineVisibility = "private" | "public" | "link_only";

export interface RoutineBase {
  id: number;
  name: string;
  description?: string | null;
  workout_type_id: number;
  creator_id: number;
  visibility: RoutineVisibility;
  is_readonly: boolean;
  created_at: string;
  updated_at: string;
}

export type RoutineReference = Pick<RoutineBase, "id">;

export interface Routine extends RoutineBase {
  exercise_templates: ExerciseTemplate[];
}

export interface RoutineSummary extends RoutineBase {
  exercise_count: number;
  set_count: number;
  exercise_names_preview: string[];
}
