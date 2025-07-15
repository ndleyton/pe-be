import api from '@/shared/api/client';
import { WorkoutType } from '../types';

export const getWorkoutTypes = async (): Promise<WorkoutType[]> => {
  const response = await api.get('/workouts/workout-types');
  return response.data;
};
