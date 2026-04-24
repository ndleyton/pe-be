import type { Routine } from "@/features/routines/types";

export interface PublicProfile {
  username: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  public_workout_count: number;
  last_public_activity_at?: string | null;
}

export interface PublicWorkoutType {
  id: number;
  name: string;
}

export interface PublicWorkoutActivitySummary {
  id: number;
  name?: string | null;
  workout_type: PublicWorkoutType;
  start_time?: string | null;
  end_time: string;
  duration_seconds?: number | null;
  exercise_count: number;
  set_count: number;
  exercise_names_preview: string[];
}

export interface PublicIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

export interface PublicExerciseSet {
  reps?: number | null;
  duration_seconds?: number | null;
  intensity?: number | null;
  rpe?: number | null;
  rir?: number | null;
  intensity_unit?: PublicIntensityUnit | null;
  type?: string | null;
}

export interface PublicWorkoutExercise {
  exercise_type: {
    id: number;
    name: string;
  };
  sets: PublicExerciseSet[];
}

export interface PublicWorkoutActivity extends PublicWorkoutActivitySummary {
  exercises: PublicWorkoutExercise[];
}

export interface PaginatedPublicWorkoutActivities {
  data: PublicWorkoutActivitySummary[];
  next_cursor?: number | null;
}

export type SavePublicWorkoutAsRoutineResult = Routine;
