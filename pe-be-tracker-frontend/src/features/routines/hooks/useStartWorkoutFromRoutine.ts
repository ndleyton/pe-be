import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { startWorkoutFromRoutine as startWorkoutFromRoutineRequest, getRoutine } from "@/features/routines/api";
import type { RoutineSummary } from "@/features/routines/types";
import {
  DATE_LABEL_LOCALE,
  DATE_LABEL_OPTIONS,
} from "@/features/routines/lib/routineEditor";
import { useAuthStore, useGuestStore } from "@/stores";
import { getCurrentUTCTimestamp } from "@/utils/date";

const DEFAULT_GUEST_WORKOUT_TYPE_ID = "8";

const buildWorkoutName = (routineName: string) =>
  `${routineName} - ${new Date().toLocaleDateString(
    DATE_LABEL_LOCALE,
    DATE_LABEL_OPTIONS,
  )}`;

export const useStartWorkoutFromRoutine = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestWorkoutTypes = useGuestStore((state) => state.workoutTypes);
  const addGuestWorkout = useGuestStore((state) => state.addWorkout);

  return useCallback(
    async (routineSummary: RoutineSummary) => {
      try {
        if (isAuthenticated) {
          const newWorkout = await startWorkoutFromRoutineRequest(routineSummary.id);
          navigate(`/workouts/${newWorkout.id}`);
          return;
        }

        // Guests need the full routine tree to instantiate local default sets
        const fullRoutine = await getRoutine(routineSummary.id);

        const defaultWorkoutType =
          guestWorkoutTypes.find(
            (workoutType) =>
              workoutType.id === DEFAULT_GUEST_WORKOUT_TYPE_ID,
          ) ?? guestWorkoutTypes[0];

        if (!defaultWorkoutType) {
          throw new Error("No workout types available");
        }

        const newWorkoutId = addGuestWorkout({
          name: buildWorkoutName(fullRoutine.name),
          notes: null,
          start_time: getCurrentUTCTimestamp(),
          end_time: null,
          workout_type_id: defaultWorkoutType.id,
          workout_type: defaultWorkoutType,
          exercises: [],
        });

        navigate(`/workouts/${newWorkoutId}`, { state: { routine: fullRoutine } });
      } catch (error) {
        console.error("Failed to start workout from routine:", error);
      }
    },
    [addGuestWorkout, guestWorkoutTypes, isAuthenticated, navigate],
  );
};
