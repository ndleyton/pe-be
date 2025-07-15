import api from '@/shared/api/client';
import { Workout, CreateWorkoutData, UpdateWorkoutData } from './types';

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
