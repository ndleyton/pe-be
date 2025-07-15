import api from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';

// Types
export interface Workout {
  id: number | string;
  name: string | null;
  notes: string | null;
  start_time: string;
  end_time: string | null;
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

export interface AddExerciseToWorkoutPayload {
  exercise_type_id: number;
  initial_set?: {
    reps?: number | null;
    intensity?: number | null;
    intensity_unit_id: number;
    rest_time_seconds?: number | null;
  } | null;
}

// Workout API functions
export const getMyWorkouts = async (
  offset: number = 0,
  limit: number = 100
): Promise<Workout[]> => {
  const response = await api.get(`/workouts/mine?offset=${offset}&limit=${limit}`);
  return response.data;
};

export const getWorkoutById = async (workoutId: string | number): Promise<Workout> => {
  const response = await api.get(`/workouts/${workoutId}`);
  return response.data;
};

export const createWorkout = async (workoutData: CreateWorkoutData): Promise<Workout> => {
  const response = await api.post('/workouts/', workoutData);
  return response.data;
};

export const updateWorkout = async (
  workoutId: string | number,
  updateData: UpdateWorkoutData
): Promise<Workout> => {
  const response = await api.patch(`/workouts/${workoutId}`, updateData);
  return response.data;
};

export const deleteWorkout = async (workoutId: string | number): Promise<void> => {
  await api.delete(`/workouts/${workoutId}`);
};

// Workout Type API functions
export const getWorkoutTypes = async (): Promise<WorkoutType[]> => {
  const response = await api.get('/workouts/workout-types');
  return response.data;
};

export const addExerciseToCurrentWorkout = async (
  payload: AddExerciseToWorkoutPayload,
): Promise<any> => {
  const response = await api.post(endpoints.addExerciseToCurrentWorkout, payload);
  return response.data;
}; 