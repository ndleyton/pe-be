import api from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import type { MuscleGroup, Muscle } from '@/shared/types';

export type { MuscleGroup, Muscle };

export interface ExerciseType {
  id: number | string;
  name: string;
  description: string | null;
  default_intensity_unit: number;
  times_used: number;
  muscles?: Muscle[];
  created_at?: string;
  updated_at?: string;
}

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

// Get all exercise types (ordered by usage by default)
export const getExerciseTypes = async (orderBy: 'usage' | 'name' = 'usage'): Promise<ExerciseType[]> => {
  const response = await api.get(`${endpoints.exerciseTypes}?order_by=${orderBy}`);
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