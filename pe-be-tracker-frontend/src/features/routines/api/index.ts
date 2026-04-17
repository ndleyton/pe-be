import api from "@/shared/api/client";
import { Routine, type RoutineVisibility, type RoutineSummary } from "@/features/routines/types";
import { endpoints } from "@/shared/api/endpoints";

// Create/Update payload types for routines
export interface CreateRoutineData {
  name: string;
  description?: string | null;
  workout_type_id: number;
  visibility?: RoutineVisibility;
  author?: string | null;
  category?: string | null;
  exercise_templates: Array<{
    exercise_type_id: number;
    set_templates: Array<{
      reps?: number | null;
      duration_seconds?: number | null;
      intensity?: number | null;
      rpe?: number | null;
      intensity_unit_id: number;
    }>;
  }>;
}

export interface RoutineTemplatePayload {
  exercise_type_id: number;
  set_templates: Array<{
    reps?: number | null;
    duration_seconds?: number | null;
    intensity?: number | null;
    rpe?: number | null;
    intensity_unit_id: number;
  }>;
}

export interface UpdateRoutineData {
  name?: string;
  description?: string | null;
  workout_type_id?: number;
  visibility?: RoutineVisibility;
  exercise_templates?: RoutineTemplatePayload[];
}

export const getRoutines = async (
  orderBy: "name" | "createdAt" = "createdAt",
  cursor?: number | null,
  limit: number = 100,
): Promise<{ data: RoutineSummary[]; next_cursor?: number | null }> => {
  const currentOffset = cursor ?? 0;
  const response = await api.get(endpoints.routinesSummary, {
    params: {
      order_by: orderBy,
      offset: currentOffset,
      limit: limit,
    },
  });
  const items: RoutineSummary[] = Array.isArray(response.data) ? response.data : [];
  const next_cursor =
    items.length < limit ? null : currentOffset + items.length;
  return { data: items, next_cursor };
};

export const getRoutine = async (id: number): Promise<Routine> => {
  const response = await api.get(endpoints.routineById(id));
  return response.data;
};

export const createRoutine = async (
  routineData: CreateRoutineData,
): Promise<Routine> => {
  // Backend is mounted at /api/v1/routines/ and prefers trailing slash for POST
  const response = await api.post(endpoints.routines, routineData);
  return response.data;
};

export const updateRoutine = async (
  routineId: string | number,
  updateData: UpdateRoutineData,
): Promise<Routine> => {
  const response = await api.put(endpoints.routineById(routineId), updateData);
  return response.data;
};

export const deleteRoutine = async (
  routineId: string | number,
): Promise<void> => {
  await api.delete(endpoints.routineById(routineId));
};

export const startWorkoutFromRoutine = async (
  routineId: number | string,
): Promise<{ id: number }> => {
  const response = await api.post(endpoints.startWorkoutFromRoutine(routineId));
  return response.data;
};
