import api from "@/shared/api/client";
import { Workout, CreateWorkoutData, UpdateWorkoutData } from "../types";

/**
 * Fetch the current user's workouts using cursor-based pagination.
 *
 * @param cursor - The cursor returned from the previous page (or undefined for the first page)
 * @param limit  - Maximum number of workouts to return (default 100)
 */
export const getMyWorkouts = async (
  cursor?: number | null,
  limit: number = 100,
): Promise<{ data: Workout[]; next_cursor?: number | null }> => {
  const params = new URLSearchParams();
  if (cursor !== undefined && cursor !== null) {
    params.set("cursor", String(cursor));
  }
  params.set("limit", String(limit));

  const query = params.toString();
  const url = query ? `/workouts/mine?${query}` : "/workouts/mine";
  const response = await api.get(url);

  // Server returns: { data: [...], next_cursor: ... }
  return response.data;
};

export const getWorkoutById = async (
  workoutId: string | number,
): Promise<Workout> => {
  const response = await api.get(`/workouts/${workoutId}`);
  return response.data;
};

export const createWorkout = async (
  workoutData: CreateWorkoutData,
): Promise<Workout> => {
  const response = await api.post("/workouts/", workoutData);
  return response.data;
};

export const updateWorkout = async (
  workoutId: string | number,
  updateData: UpdateWorkoutData,
): Promise<Workout> => {
  const response = await api.patch(`/workouts/${workoutId}`, updateData);
  return response.data;
};

export const deleteWorkout = async (
  workoutId: string | number,
): Promise<void> => {
  await api.delete(`/workouts/${workoutId}`);
};
