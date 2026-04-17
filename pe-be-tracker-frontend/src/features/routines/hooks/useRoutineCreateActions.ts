import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createRoutine } from "@/features/routines/api";
import {
  buildRoutinePayload,
  type RoutineEditorTemplate,
} from "@/features/routines/lib/routineEditor";
import type { RoutineVisibility } from "@/features/routines/types";
import { getWorkoutTypes } from "@/features/workouts/api/workoutTypeApi";

const resolveDefaultWorkoutTypeId = async (queryClient: ReturnType<typeof useQueryClient>) => {
  const workoutTypes = await queryClient.ensureQueryData({
    queryKey: ["workoutTypes"],
    queryFn: getWorkoutTypes,
  });

  const defaultWorkoutType =
    workoutTypes.find((workoutType) => workoutType.name === "Strength Training") ??
    workoutTypes[0];

  if (!defaultWorkoutType) {
    throw new Error("No workout types are available for routine creation.");
  }

  return defaultWorkoutType.id;
};

export const useRoutineCreateActions = ({
  description,
  editorTemplates,
  isAuthenticated,
  name,
  onBeforeNavigate,
  visibility,
  author,
  category,
}: {
  description: string;
  editorTemplates: RoutineEditorTemplate[];
  isAuthenticated: boolean;
  name: string;
  onBeforeNavigate?: () => void;
  visibility: RoutineVisibility;
  author: string | null;
  category: string | null;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) {
        throw new Error("Sign in to create a routine.");
      }

      const workoutTypeId = await resolveDefaultWorkoutTypeId(queryClient);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        workout_type_id: workoutTypeId,
        visibility,
        author: author?.trim() || null,
        category: category?.trim() || null,
        exercise_templates: buildRoutinePayload(editorTemplates),
      };

      return createRoutine(payload);
    },
    onSuccess: async (createdRoutine) => {
      onBeforeNavigate?.();
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      navigate(`/routines/${createdRoutine.id}`);
    },
  });

  return {
    saveMutation,
  };
};
