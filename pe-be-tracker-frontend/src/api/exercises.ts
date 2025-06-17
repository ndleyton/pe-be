import api from './client';

export interface ExerciseType {
  id: number;
  name: string;
  description: string | null;
  default_intensity_unit: number;
  created_at: string;
  updated_at: string;
}

export interface ExerciseSet {
  id: number;
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  exercise_id: number;
  rest_time_seconds: number | null;
  done: boolean;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: number;
  timestamp: string | null;
  notes: string | null;
  exercise_type_id: number;
  workout_id: number;
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
  exercise_id: number;
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
export const getExerciseSets = async (exerciseId: number): Promise<ExerciseSet[]> => {
  const response = await api.get(`/exercise-sets/exercise/${exerciseId}`);
  return response.data;
};

// Update an exercise set
export const updateExerciseSet = async (exerciseSetId: number, updateData: UpdateExerciseSetData): Promise<ExerciseSet> => {
  const response = await api.put(`/exercise-sets/${exerciseSetId}`, updateData);
  return response.data;
};

// Delete an exercise set
export const deleteExerciseSet = async (exerciseSetId: number): Promise<void> => {
  await api.delete(`/exercise-sets/${exerciseSetId}`);
};