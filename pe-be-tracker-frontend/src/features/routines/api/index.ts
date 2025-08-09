import apiClient from '@/shared/api';
import { Routine } from '@/features/routines/types';

// Create/Update payload types for routines
export interface CreateRoutineData {
  name: string;
  description?: string;
  workout_type_id: number;
  exercise_templates: Array<{
    exercise_type_id: number;
    set_templates: Array<{
      reps?: number;
      intensity?: number;
      intensity_unit_id: number;
    }>;
  }>;
}

export interface UpdateRoutineData {
  name?: string;
  description?: string;
  workout_type_id?: number;
}

export const getRoutines = async (
  orderBy: 'name' | 'createdAt' = 'createdAt',
  cursor?: number | null,
  limit: number = 100
): Promise<{ data: Routine[]; next_cursor?: number | null }> => {
  const currentOffset = cursor ?? 0;
  const response = await apiClient.get('/routines/', {
    params: {
      // Backend currently ignores order_by; safe to pass for future-proofing
      order_by: orderBy,
      offset: currentOffset,
      limit: limit,
    },
  });
  const items: Routine[] = Array.isArray(response.data) ? response.data : [];
  const next_cursor = items.length < limit ? null : currentOffset + items.length;
  return { data: items, next_cursor };
};

export const getRoutine = async (id: number): Promise<Routine> => {
  const response = await apiClient.get(`/routines/${id}`);
  return response.data;
};

export const createRoutine = async (routineData: CreateRoutineData): Promise<Routine> => {
  const response = await apiClient.post('/routines', routineData);
  return response.data;
};

export const updateRoutine = async (routineId: string | number, updateData: UpdateRoutineData): Promise<Routine> => {
  const response = await apiClient.put(`/routines/${routineId}`, updateData);
  return response.data;
};

export const deleteRoutine = async (routineId: string | number): Promise<void> => {
  await apiClient.delete(`/routines/${routineId}`);
};

export const startWorkoutFromRoutine = async (routineId: number | string): Promise<{ id: number }> => {
  const response = await apiClient.post(`/routines/${routineId}/start`);
  return response.data;
};
