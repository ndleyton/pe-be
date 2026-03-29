import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { toUTCISOString } from "@/utils/date";
import type { MuscleGroup, Muscle } from "@/shared/types";
import { type ExerciseType } from "@/features/exercises/types";

export type { MuscleGroup, Muscle, ExerciseType };

export interface IntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExerciseSet {
  id: number | string;
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  exercise_id: number | string;
  rest_time_seconds: number | null;
  done: boolean;
  notes?: string | null;
  type?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Exercise {
  id: number | string;
  timestamp: string | null;
  notes: string | null;
  exercise_type_id: number | string;
  workout_id: string | number;
  created_at: string;
  updated_at: string;
  exercise_type: ExerciseType;
  exercise_sets: ExerciseSet[];
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  exercises: RecipeExercise[];
  created_at: string;
  updated_at: string;
}

export interface RecipeExercise {
  id: string;
  exercise_type_id: number | string;
  exercise_type: ExerciseType;
  sets: RecipeSet[];
  notes?: string;
}

export interface RecipeSet {
  id: string;
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  rest_time_seconds: number | null;
}

// Get exercises for a specific workout
export const getExercisesInWorkout = async (
  workoutId: string,
): Promise<Exercise[]> => {
  const response = await api.get(`/workouts/${workoutId}/exercises`);
  return response.data;
};

// Exercise API functions

export interface CreateExerciseData {
  exercise_type_id: number | string;
  workout_id: number;
  timestamp?: string | null;
  notes?: string | null;
}

// Create a new exercise
export const createExercise = async (
  data: CreateExerciseData,
): Promise<Exercise> => {
  const payload = {
    exercise_type_id: data.exercise_type_id,
    workout_id: data.workout_id,
    timestamp: data.timestamp ? toUTCISOString(data.timestamp) : null,
    notes: data.notes ?? null,
  };
  const response = await api.post(endpoints.exercises, payload);
  return response.data;
};

// Exercise Set API functions

export interface CreateExerciseSetData {
  reps?: number;
  intensity?: number;
  intensity_unit_id: number;
  exercise_id: string | number;
  rest_time_seconds?: number;
  done?: boolean;
  notes?: string;
  type?: string;
}

export interface UpdateExerciseSetData {
  reps?: number | null;
  intensity?: number | null;
  intensity_unit_id?: number;
  rest_time_seconds?: number;
  done?: boolean;
  notes?: string;
  type?: string;
}

// Create a new exercise set
export const createExerciseSet = async (
  exerciseSetData: CreateExerciseSetData,
): Promise<ExerciseSet> => {
  const response = await api.post("/exercise-sets/", exerciseSetData);
  return response.data;
};

// Get all exercise sets for an exercise
export const getExerciseSets = async (
  exerciseId: number | string,
): Promise<ExerciseSet[]> => {
  const response = await api.get(`/exercise-sets/exercise/${exerciseId}`);
  return response.data;
};

// Update an exercise set
export const updateExerciseSet = async (
  exerciseSetId: number | string,
  updateData: UpdateExerciseSetData,
): Promise<ExerciseSet> => {
  const response = await api.put(`/exercise-sets/${exerciseSetId}`, updateData);
  return response.data;
};

// Delete an exercise set
export const deleteExerciseSet = async (
  exerciseSetId: number | string,
): Promise<void> => {
  await api.delete(`/exercise-sets/${exerciseSetId}`);
};

// Delete an exercise
export const deleteExercise = async (
  exerciseId: number | string,
): Promise<void> => {
  await api.delete(`/exercises/${exerciseId}`);
};

// Exercise Type API functions

export interface CreateExerciseTypeData {
  name: string;
  description?: string;
  default_intensity_unit?: number;
}

// Get all exercise types with cursor-based pagination
export const getExerciseTypes = async (
  orderBy: "usage" | "name" = "usage",
  cursor?: number | null,
  limit: number = 1000,
  muscleGroupId?: number,
): Promise<{ data: ExerciseType[]; next_cursor?: number | null }> => {
  const offset = cursor || 0;
  const params = new URLSearchParams({
    order_by: orderBy,
    offset: String(offset),
    limit: String(limit),
  });
  if (muscleGroupId !== undefined) {
    params.set("muscle_group_id", String(muscleGroupId));
  }
  const response = await api.get(
    `${endpoints.exerciseTypes}?${params.toString()}`,
  );

  // Server returns: { data: [...], next_cursor: ... }
  return response.data;
};

export const getMuscleGroups = async (): Promise<MuscleGroup[]> => {
  const response = await api.get(endpoints.muscleGroups);
  return response.data;
};

// Create a new exercise type
export const createExerciseType = async (
  exerciseTypeData: CreateExerciseTypeData,
): Promise<ExerciseType> => {
  const response = await api.post(endpoints.exerciseTypes, exerciseTypeData);
  return response.data;
};

// Get all intensity units
export const getIntensityUnits = async (): Promise<IntensityUnit[]> => {
  const response = await api.get(endpoints.intensityUnits);
  return response.data;
};

// Get exercise type by ID
export const getExerciseTypeById = async (
  exerciseTypeId: string,
): Promise<ExerciseType> => {
  const response = await api.get(endpoints.exerciseTypeById(exerciseTypeId));
  return response.data;
};

// Exercise type statistics interfaces
export interface ProgressiveOverloadDataPoint {
  date: string;
  maxWeight: number;
  totalVolume: number;
  reps: number;
}

export interface LastWorkoutData {
  date: string;
  sets: number;
  totalReps: number;
  maxWeight: number;
  totalVolume: number;
}

export interface PersonalBestData {
  date: string;
  weight: number;
  reps: number;
  volume: number;
}

export interface ExerciseTypeStats {
  progressiveOverload: ProgressiveOverloadDataPoint[];
  lastWorkout: LastWorkoutData | null;
  personalBest: PersonalBestData | null;
  totalSets: number;
  intensityUnit: IntensityUnit;
}

// Get exercise type statistics
export const getExerciseTypeStats = async (
  exerciseTypeId: string,
): Promise<ExerciseTypeStats> => {
  const response = await api.get(
    `${endpoints.exerciseTypeById(exerciseTypeId)}/stats`,
  );
  return response.data;
};
