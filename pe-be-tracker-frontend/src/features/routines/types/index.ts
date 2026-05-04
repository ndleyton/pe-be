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
  images?: string[];
}

export interface SetTemplate {
  id: number;
  reps?: number | null;
  duration_seconds?: number | null;
  intensity?: number | null;
  rpe?: number | null;
  rir?: number | null;
  intensity_unit_id: number;
  notes?: string | null;
  type?: string | null;
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
  author?: string | null;
  category?: string | null;
  created_at: string;
  updated_at: string;
  times_used: number;
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

export type RoutineProgramVisibility = RoutineVisibility;

export interface RoutineProgramRoutineSummary {
  id: number;
  name: string;
  exercise_count: number;
  set_count: number;
  exercise_names_preview: string[];
}

export interface RoutineProgramDay {
  id: number;
  routine_id: number;
  day_label: string;
  sort_order: number;
  week_number?: number | null;
  phase_label?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  routine: RoutineProgramRoutineSummary;
}

export interface RoutineProgramSummary {
  id: number;
  name: string;
  description?: string | null;
  creator_id: number;
  visibility: RoutineProgramVisibility;
  author?: string | null;
  category?: string | null;
  source_label?: string | null;
  is_readonly: boolean;
  times_used: number;
  day_count: number;
  routine_count: number;
  exercise_count: number;
  set_count: number;
  day_labels_preview: string[];
  created_at: string;
  updated_at: string;
}

export interface RoutineProgram extends Omit<RoutineProgramSummary, "day_count" | "routine_count" | "exercise_count" | "set_count" | "day_labels_preview"> {
  days: RoutineProgramDay[];
}
