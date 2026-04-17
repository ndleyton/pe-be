import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createRoutine } from "@/features/routines/api";
import {
  buildRoutinePayload,
  type RoutineEditorTemplate,
} from "@/features/routines/lib/routineEditor";
import type { RoutineVisibility } from "@/features/routines/types";

// Default Strength Training workout type ID (from backend/src/workouts/service.py)
const DEFAULT_WORKOUT_TYPE_ID = 4;

export const useRoutineCreateActions = ({
  description,
  editorTemplates,
  isAuthenticated,
  name,
  visibility,
  author,
  category,
}: {
  description: string;
  editorTemplates: RoutineEditorTemplate[];
  isAuthenticated: boolean;
  name: string;
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

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        workout_type_id: DEFAULT_WORKOUT_TYPE_ID,
        visibility,
        author: author != null ? author.trim() : null,
        category: category != null ? category.trim() : null,
        exercise_templates: buildRoutinePayload(editorTemplates),
      };

      return createRoutine(payload);
    },
    onSuccess: async (createdRoutine) => {
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      navigate(`/routines/${createdRoutine.id}`);
    },
  });

  return {
    saveMutation,
  };
};
