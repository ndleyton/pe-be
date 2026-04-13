import { buildExerciseTypes } from "./seeds/exerciseTypes";
import { buildWorkoutTypes } from "./seeds/workoutTypes";
import { generateExerciseTypeIds } from "./seeds/types";
import type { GuestData } from "./useGuestStore";

type IdGenerator = () => string;

export const createInitialGuestData = (
  generateId: IdGenerator,
): GuestData => {
  const exerciseTypeIds = generateExerciseTypeIds(generateId);
  const exerciseTypes = buildExerciseTypes(exerciseTypeIds);

  return {
    workouts: [],
    exerciseTypes,
    workoutTypes: buildWorkoutTypes(generateId),
    routines: [],
  };
};
