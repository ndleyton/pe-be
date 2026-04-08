export interface Workout {
  id: number | string;
  name: string | null;
  notes: string | null;
  start_time: string;
  end_time: string | null;
  workout_type_id: number;
  recap?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutType {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkoutData {
  name?: string | null;
  notes?: string | null;
  workout_type_id?: number;
}

export interface UpdateWorkoutData {
  name?: string | null;
  notes?: string | null;
  end_time?: string | null;
}

// Cursor-based paginated response wrapper
export interface PaginatedWorkouts {
  data: Workout[];
  next_cursor?: number | null;
}

export interface AddExerciseToWorkoutPayload {
  exercise_type_id: number;
  initial_set?: {
    reps?: number | null;
    duration_seconds?: number | null;
    intensity?: number | null;
    rpe?: number | null;
    intensity_unit_id: number;
    rest_time_seconds?: number | null;
  } | null;
}
