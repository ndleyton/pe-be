import type { GuestExercise, GuestExerciseSet, GuestWorkout } from "./useGuestStore";

const replaceAtIndex = <T,>(items: T[], index: number, nextItem: T): T[] => {
  const nextItems = items.slice();
  nextItems[index] = nextItem;
  return nextItems;
};

export const updateWorkoutById = (
  workouts: GuestWorkout[],
  workoutId: string,
  updater: (workout: GuestWorkout) => GuestWorkout,
): GuestWorkout[] => {
  const workoutIndex = workouts.findIndex((workout) => workout.id === workoutId);
  if (workoutIndex === -1) {
    return workouts;
  }

  const currentWorkout = workouts[workoutIndex];
  const nextWorkout = updater(currentWorkout);
  if (nextWorkout === currentWorkout) {
    return workouts;
  }

  return replaceAtIndex(workouts, workoutIndex, nextWorkout);
};

export const updateExerciseById = (
  workouts: GuestWorkout[],
  exerciseId: string,
  updater: (exercise: GuestExercise) => GuestExercise,
): GuestWorkout[] => {
  for (let workoutIndex = 0; workoutIndex < workouts.length; workoutIndex += 1) {
    const workout = workouts[workoutIndex];
    const exerciseIndex = workout.exercises.findIndex(
      (exercise) => exercise.id === exerciseId,
    );

    if (exerciseIndex === -1) {
      continue;
    }

    const currentExercise = workout.exercises[exerciseIndex];
    const nextExercise = updater(currentExercise);
    if (nextExercise === currentExercise) {
      return workouts;
    }

    const nextExercises = replaceAtIndex(
      workout.exercises,
      exerciseIndex,
      nextExercise,
    );

    return replaceAtIndex(workouts, workoutIndex, {
      ...workout,
      exercises: nextExercises,
    });
  }

  return workouts;
};

export const removeExerciseById = (
  workouts: GuestWorkout[],
  exerciseId: string,
): GuestWorkout[] => {
  for (let workoutIndex = 0; workoutIndex < workouts.length; workoutIndex += 1) {
    const workout = workouts[workoutIndex];
    const exerciseIndex = workout.exercises.findIndex(
      (exercise) => exercise.id === exerciseId,
    );

    if (exerciseIndex === -1) {
      continue;
    }

    return replaceAtIndex(workouts, workoutIndex, {
      ...workout,
      exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId),
    });
  }

  return workouts;
};

export const updateExerciseSetById = (
  workouts: GuestWorkout[],
  setId: string,
  updater: (set: GuestExerciseSet) => GuestExerciseSet,
): GuestWorkout[] => {
  for (let workoutIndex = 0; workoutIndex < workouts.length; workoutIndex += 1) {
    const workout = workouts[workoutIndex];

    for (
      let exerciseIndex = 0;
      exerciseIndex < workout.exercises.length;
      exerciseIndex += 1
    ) {
      const exercise = workout.exercises[exerciseIndex];
      const setIndex = exercise.exercise_sets.findIndex((set) => set.id === setId);

      if (setIndex === -1) {
        continue;
      }

      const currentSet = exercise.exercise_sets[setIndex];
      const nextSet = updater(currentSet);
      if (nextSet === currentSet) {
        return workouts;
      }

      const nextSets = replaceAtIndex(exercise.exercise_sets, setIndex, nextSet);
      const nextExercise = {
        ...exercise,
        exercise_sets: nextSets,
      };
      const nextExercises = replaceAtIndex(
        workout.exercises,
        exerciseIndex,
        nextExercise,
      );

      return replaceAtIndex(workouts, workoutIndex, {
        ...workout,
        exercises: nextExercises,
      });
    }
  }

  return workouts;
};

export const removeExerciseSetById = (
  workouts: GuestWorkout[],
  setId: string,
): GuestWorkout[] => {
  for (let workoutIndex = 0; workoutIndex < workouts.length; workoutIndex += 1) {
    const workout = workouts[workoutIndex];

    for (
      let exerciseIndex = 0;
      exerciseIndex < workout.exercises.length;
      exerciseIndex += 1
    ) {
      const exercise = workout.exercises[exerciseIndex];
      const setIndex = exercise.exercise_sets.findIndex((set) => set.id === setId);

      if (setIndex === -1) {
        continue;
      }

      const nextSets = exercise.exercise_sets.filter((set) => set.id !== setId);
      const nextExercise = {
        ...exercise,
        exercise_sets: nextSets,
      };
      const nextExercises = replaceAtIndex(
        workout.exercises,
        exerciseIndex,
        nextExercise,
      );

      return replaceAtIndex(workouts, workoutIndex, {
        ...workout,
        exercises: nextExercises,
      });
    }
  }

  return workouts;
};
