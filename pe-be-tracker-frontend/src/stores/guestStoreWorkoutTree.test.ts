import { describe, expect, it } from "vitest";
import {
  removeExerciseById,
  removeExerciseSetById,
  updateExerciseById,
  updateExerciseSetById,
} from "./guestStoreWorkoutTree";
import {
  makeGuestExercise,
  makeGuestSet,
  makeGuestWorkout,
} from "@/test/fixtures";

describe("guestStoreWorkoutTree", () => {
  it("updates an exercise while preserving untouched references", () => {
    const touchedExercise = makeGuestExercise({
      id: "exercise-1",
      notes: "before",
    });
    const untouchedExercise = makeGuestExercise({
      id: "exercise-2",
      notes: "untouched",
    });
    const firstWorkout = makeGuestWorkout({
      id: "workout-1",
      exercises: [touchedExercise, untouchedExercise],
    });
    const secondWorkout = makeGuestWorkout({
      id: "workout-2",
      exercises: [makeGuestExercise({ id: "exercise-3" })],
    });
    const workouts = [firstWorkout, secondWorkout];

    const next = updateExerciseById(workouts, "exercise-1", (exercise) => ({
      ...exercise,
      notes: "after",
    }));

    expect(next).not.toBe(workouts);
    expect(next[0]).not.toBe(firstWorkout);
    expect(next[1]).toBe(secondWorkout);
    expect(next[0].exercises[0]).not.toBe(touchedExercise);
    expect(next[0].exercises[1]).toBe(untouchedExercise);
    expect(next[0].exercises[0].notes).toBe("after");
  });

  it("updates and removes nested sets without rewriting unrelated branches", () => {
    const touchedSet = makeGuestSet({ id: "set-1", done: false });
    const untouchedSet = makeGuestSet({ id: "set-2", done: false });
    const touchedExercise = makeGuestExercise({
      id: "exercise-1",
      exercise_sets: [touchedSet, untouchedSet],
    });
    const siblingExercise = makeGuestExercise({
      id: "exercise-2",
      exercise_sets: [makeGuestSet({ id: "set-3" })],
    });
    const workout = makeGuestWorkout({
      id: "workout-1",
      exercises: [touchedExercise, siblingExercise],
    });
    const workouts = [workout];

    const updated = updateExerciseSetById(workouts, "set-1", (set) => ({
      ...set,
      done: true,
    }));

    expect(updated[0]).not.toBe(workout);
    expect(updated[0].exercises[0]).not.toBe(touchedExercise);
    expect(updated[0].exercises[1]).toBe(siblingExercise);
    expect(updated[0].exercises[0].exercise_sets[0]).not.toBe(touchedSet);
    expect(updated[0].exercises[0].exercise_sets[1]).toBe(untouchedSet);
    expect(updated[0].exercises[0].exercise_sets[0].done).toBe(true);

    const removedSet = removeExerciseSetById(updated, "set-2");
    expect(removedSet[0].exercises[0].exercise_sets).toHaveLength(1);
    expect(removedSet[0].exercises[0].exercise_sets[0].id).toBe("set-1");

    const removedExercise = removeExerciseById(removedSet, "exercise-2");
    expect(removedExercise[0].exercises).toHaveLength(1);
    expect(removedExercise[0].exercises[0].id).toBe("exercise-1");
  });
});
