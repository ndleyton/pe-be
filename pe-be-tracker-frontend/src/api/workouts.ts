import api from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';

// Types (reuse existing types from other modules if needed) but keep minimal here
export interface AddExerciseToWorkoutPayload {
  exercise_type_id: number;
  initial_set?: {
    reps?: number | null;
    intensity?: number | null;
    intensity_unit_id: number;
    rest_time_seconds?: number | null;
  } | null;
}

export const addExerciseToCurrentWorkout = async (
  payload: AddExerciseToWorkoutPayload,
): Promise<any> => {
  const response = await api.post(endpoints.addExerciseToCurrentWorkout, payload);
  return response.data;
}; 