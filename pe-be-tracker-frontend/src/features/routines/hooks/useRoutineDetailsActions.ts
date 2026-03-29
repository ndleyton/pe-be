import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  deleteRoutine,
  startWorkoutFromRoutine,
  updateRoutine,
} from "@/features/routines/api";
import {
  DATE_LABEL_LOCALE,
  DATE_LABEL_OPTIONS,
  buildRoutinePayload,
  toGuestRoutineExercises,
  type RoutineEditorTemplate,
} from "@/features/routines/lib/routineEditor";
import type { Routine } from "@/features/routines/types";
import { useGuestStore, type GuestRoutine } from "@/stores";

export const useRoutineDetailsActions = ({
  canEdit,
  description,
  editorTemplates,
  guestRoutine,
  isAuthenticated,
  name,
  routine,
  routineId,
}: {
  canEdit: boolean;
  description: string;
  editorTemplates: RoutineEditorTemplate[];
  guestRoutine: GuestRoutine | undefined;
  isAuthenticated: boolean;
  name: string;
  routine: Routine | null;
  routineId: string | undefined;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const updateGuestRoutine = useGuestStore((state) => state.updateRoutine);
  const deleteGuestRoutine = useGuestStore((state) => state.deleteRoutine);
  const addGuestWorkout = useGuestStore((state) => state.addWorkout);
  const createExercisesFromRoutine = useGuestStore(
    (state) => state.createExercisesFromRoutine,
  );
  const guestWorkoutTypes = useGuestStore((state) => state.workoutTypes);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!routine) {
        throw new Error("Routine not found");
      }

      if (isAuthenticated && !canEdit) {
        throw new Error("You do not have permission to edit this routine.");
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        workout_type_id: routine.workout_type_id,
        exercise_templates: buildRoutinePayload(editorTemplates),
      };

      if (isAuthenticated) {
        return updateRoutine(routine.id, payload);
      }

      updateGuestRoutine(guestRoutine?.id ?? String(routine.id), {
        description: payload.description ?? undefined,
        exercises: toGuestRoutineExercises(editorTemplates),
        name: payload.name,
      });

      return null;
    },
    onSuccess: async (updatedRoutine) => {
      if (!routineId) {
        return;
      }

      if (updatedRoutine) {
        queryClient.setQueryData(["routine", routineId], updatedRoutine);
      }

      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      await queryClient.invalidateQueries({ queryKey: ["routine", routineId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!routine) {
        throw new Error("Routine not found");
      }

      if (isAuthenticated && !canEdit) {
        throw new Error("You do not have permission to delete this routine.");
      }

      if (isAuthenticated) {
        await deleteRoutine(routine.id);
        return;
      }

      deleteGuestRoutine(guestRoutine?.id ?? String(routine.id));
    },
    onSuccess: () => {
      navigate("/routines");
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!routine) {
        throw new Error("Routine not found");
      }

      if (isAuthenticated) {
        return startWorkoutFromRoutine(routine.id);
      }

      if (guestWorkoutTypes.length === 0) {
        throw new Error("No workout types available");
      }

      const defaultWorkoutType =
        guestWorkoutTypes.find((type) => type.id === "8") ?? guestWorkoutTypes[0];
      const workoutName = `${name.trim() || routine.name} - ${new Date().toLocaleDateString(
        DATE_LABEL_LOCALE,
        DATE_LABEL_OPTIONS,
      )}`;
      const newWorkoutId = addGuestWorkout({
        end_time: null,
        exercises: [],
        name: workoutName,
        notes: null,
        start_time: new Date().toISOString(),
        workout_type: defaultWorkoutType,
        workout_type_id: defaultWorkoutType.id,
      });

      const guestRoutineForStart = {
        created_at: guestRoutine?.created_at ?? routine.created_at,
        description: description.trim() || undefined,
        exercises: toGuestRoutineExercises(editorTemplates),
        id: guestRoutine?.id ?? String(routine.id),
        name: name.trim() || routine.name,
        updated_at: guestRoutine?.updated_at ?? routine.updated_at,
      } satisfies GuestRoutine;

      createExercisesFromRoutine(guestRoutineForStart, newWorkoutId);
      return { id: newWorkoutId };
    },
    onSuccess: (result) => {
      if (!result) {
        return;
      }

      navigate(`/workouts/${result.id}`);
    },
  });

  const handleDelete = () => {
    if (!routine || !canEdit) {
      return;
    }

    const confirmed = window.confirm(
      `Delete routine "${routine.name}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    deleteMutation.mutate();
  };

  return {
    deleteMutation,
    handleDelete,
    saveMutation,
    startMutation,
  };
};
