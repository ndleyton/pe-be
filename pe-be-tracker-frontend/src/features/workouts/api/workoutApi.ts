import api from "@/shared/api/client";
import { resolveApiAssetUrl } from "@/shared/api/assets";
import { endpoints } from "@/shared/api/endpoints";
import {
  Workout,
  WorkoutPhoto,
  CreateWorkoutData,
  UpdateWorkoutData,
} from "../types";

const normalizeWorkoutPhoto = (
  photo?: WorkoutPhoto | null,
): WorkoutPhoto | null | undefined => {
  if (!photo) {
    return photo;
  }

  return {
    ...photo,
    url: resolveApiAssetUrl(photo.url),
  };
};

const normalizeWorkout = (workout: Workout): Workout => ({
  ...workout,
  photo: normalizeWorkoutPhoto(workout.photo),
});

/**
 * Fetch the current user's workouts using cursor-based pagination.
 *
 * @param cursor - The cursor returned from the previous page (or undefined for the first page)
 * @param limit  - Maximum number of workouts to return (default 100)
 */
export const getMyWorkouts = async (
  cursor?: number | null,
  limit: number = 25,
): Promise<{ data: Workout[]; next_cursor?: number | null }> => {
  const params = new URLSearchParams();
  if (cursor !== undefined && cursor !== null) {
    params.set("cursor", String(cursor));
  }
  params.set("limit", String(limit));

  const query = params.toString();
  const url = query
    ? `${endpoints.myWorkouts}?${query}`
    : endpoints.myWorkouts;
  const response = await api.get(url);

  // Server returns: { data: [...], next_cursor: ... }
  return {
    ...response.data,
    data: Array.isArray(response.data?.data)
      ? response.data.data.map(normalizeWorkout)
      : [],
  };
};

export const getWorkoutById = async (
  workoutId: string | number,
): Promise<Workout> => {
  const response = await api.get(endpoints.workoutById(workoutId));
  return normalizeWorkout(response.data);
};

export const createWorkout = async (
  workoutData: CreateWorkoutData,
): Promise<Workout> => {
  const response = await api.post(endpoints.workouts, workoutData);
  return normalizeWorkout(response.data);
};

export const updateWorkout = async (
  workoutId: string | number,
  updateData: UpdateWorkoutData,
): Promise<Workout> => {
  const response = await api.patch(endpoints.workoutById(workoutId), updateData);
  return normalizeWorkout(response.data);
};

export const uploadWorkoutPhoto = async (
  workoutId: string | number,
  file: File,
): Promise<WorkoutPhoto> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(endpoints.workoutPhoto(workoutId), formData);
  return normalizeWorkoutPhoto(response.data) as WorkoutPhoto;
};

export const deleteWorkout = async (
  workoutId: string | number,
): Promise<void> => {
  await api.delete(endpoints.workoutById(workoutId));
};
