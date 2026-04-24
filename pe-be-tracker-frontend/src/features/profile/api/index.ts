import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type {
  PaginatedPublicWorkoutActivities,
  PublicProfile,
  PublicWorkoutActivity,
  SavePublicWorkoutAsRoutineResult,
} from "@/features/profile/types";

export const getPublicProfile = async (
  username: string,
): Promise<PublicProfile> => {
  const response = await api.get(endpoints.publicProfile(username));
  return response.data;
};

export const getPublicActivities = async (
  username: string,
  cursor?: number | null,
  limit: number = 20,
): Promise<PaginatedPublicWorkoutActivities> => {
  const response = await api.get(endpoints.publicProfileActivities(username), {
    params: { cursor, limit },
  });
  return response.data;
};

export const getPublicActivity = async (
  username: string,
  workoutId: string | number,
): Promise<PublicWorkoutActivity> => {
  const response = await api.get(endpoints.publicProfileActivity(username, workoutId));
  return response.data;
};

export const savePublicActivityAsRoutine = async (
  username: string,
  workoutId: string | number,
): Promise<SavePublicWorkoutAsRoutineResult> => {
  const response = await api.post(
    endpoints.savePublicProfileActivityAsRoutine(username, workoutId),
  );
  return response.data;
};
