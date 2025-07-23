import api from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import type { MuscleGroup, Muscle } from '@/shared/types';
import { type ExerciseType } from '@/features/exercises/types';

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
  created_at: string;
  updated_at: string;
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
export const getExercisesInWorkout = async (workoutId: string): Promise<Exercise[]> => {
  const response = await api.get(`/workouts/${workoutId}/exercises`);
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
}

export interface UpdateExerciseSetData {
  reps?: number;
  intensity?: number;
  intensity_unit_id?: number;
  rest_time_seconds?: number;
  done?: boolean;
}

// Create a new exercise set
export const createExerciseSet = async (exerciseSetData: CreateExerciseSetData): Promise<ExerciseSet> => {
  const response = await api.post('/exercise-sets/', exerciseSetData);
  return response.data;
};

// Get all exercise sets for an exercise
export const getExerciseSets = async (exerciseId: number | string): Promise<ExerciseSet[]> => {
  const response = await api.get(`/exercise-sets/exercise/${exerciseId}`);
  return response.data;
};

// Update an exercise set
export const updateExerciseSet = async (exerciseSetId: number | string, updateData: UpdateExerciseSetData): Promise<ExerciseSet> => {
  const response = await api.put(`/exercise-sets/${exerciseSetId}`, updateData);
  return response.data;
};

// Delete an exercise set
export const deleteExerciseSet = async (exerciseSetId: number | string): Promise<void> => {
  await api.delete(`/exercise-sets/${exerciseSetId}`);
};

// Exercise Type API functions

export interface CreateExerciseTypeData {
  name: string;
  description?: string;
  default_intensity_unit?: number;
}

// Get all exercise types with cursor-based pagination
export const getExerciseTypes = async (
  orderBy: 'usage' | 'name' = 'usage',
  cursor?: number | null,
  limit: number = 1000
): Promise<{ data: ExerciseType[]; next_cursor?: number | null }> => {
  const offset = cursor || 0;
  const response = await api.get(`${endpoints.exerciseTypes}?order_by=${orderBy}&offset=${offset}&limit=${limit}`);
  
  // Server returns: { data: [...], next_cursor: ... }
  return response.data;
};

// Create a new exercise type
export const createExerciseType = async (exerciseTypeData: CreateExerciseTypeData): Promise<ExerciseType> => {
  const response = await api.post(endpoints.exerciseTypes, exerciseTypeData);
  return response.data;
};

// Get all intensity units
export const getIntensityUnits = async (): Promise<IntensityUnit[]> => {
  const response = await api.get(endpoints.intensityUnits);
  return response.data;
};

// Get exercise type by ID
export const getExerciseTypeById = async (exerciseTypeId: string): Promise<ExerciseType> => {
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
export const getExerciseTypeStats = async (exerciseTypeId: string): Promise<ExerciseTypeStats> => {
  const response = await api.get(`${endpoints.exerciseTypeById(exerciseTypeId)}/stats`);
  return response.data;
};