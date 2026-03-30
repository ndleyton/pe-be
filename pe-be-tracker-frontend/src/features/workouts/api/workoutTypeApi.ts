import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { WorkoutType } from "../types";

export const getWorkoutTypes = async (): Promise<WorkoutType[]> => {
  const response = await api.get(endpoints.workoutTypes);
  return response.data;
};
