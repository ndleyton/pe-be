import api from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { AddExerciseToWorkoutPayload } from './types';

export const addExerciseToCurrentWorkout = async (
  payload: AddExerciseToWorkoutPayload,
): Promise<any> => {
  const response = await api.post(endpoints.addExerciseToCurrentWorkout, payload);
  return response.data;
};
