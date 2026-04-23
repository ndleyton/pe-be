import {
  type ChatApiExerciseSubstitutionsEvent,
  type ChatApiRoutineCreatedEvent,
  type ChatApiWorkoutCreatedEvent,
  type ChatEvent,
  type ExerciseSubstitutionsEvent,
  type RoutineCreatedEvent,
  type WorkoutCreatedEvent,
} from "../types";

export const parseWorkoutCreatedEvent = (
  event: ChatApiWorkoutCreatedEvent,
): WorkoutCreatedEvent => {
  return {
    type: "workout_created",
    title: event.title ?? undefined,
    ctaLabel: event.cta_label ?? undefined,
    workout: {
      id: event.workout.id,
      name: event.workout.name,
      notes: event.workout.notes,
      start_time: event.workout.start_time,
      end_time: event.workout.end_time,
    },
  };
};

export const parseRoutineCreatedEvent = (
  event: ChatApiRoutineCreatedEvent,
): RoutineCreatedEvent => {
  return {
    type: "routine_created",
    title: event.title ?? undefined,
    ctaLabel: event.cta_label ?? undefined,
    routine: {
      id: event.routine.id,
      name: event.routine.name,
      description: event.routine.description,
      workout_type_id: event.routine.workout_type_id,
      exercise_count: event.routine.exercise_count,
      set_count: event.routine.set_count,
    },
  };
};

export const parseExerciseSubstitutionsEvent = (
  event: ChatApiExerciseSubstitutionsEvent,
): ExerciseSubstitutionsEvent => {
  return {
    type: "exercise_substitutions_recommended",
    title: event.title ?? undefined,
    strategy: event.strategy,
    sourceExercise: {
      id: event.source_exercise.id,
      name: event.source_exercise.name,
    },
    substitutions: event.substitutions.map((substitution) => ({
      id: substitution.id,
      name: substitution.name,
      description: substitution.description,
      equipment: substitution.equipment,
      category: substitution.category,
      matchReason: substitution.match_reason,
      muscles: substitution.muscles,
    })),
  };
};

export const extractChatEvents = (
  events?: Array<
    | ChatApiWorkoutCreatedEvent
    | ChatApiRoutineCreatedEvent
    | ChatApiExerciseSubstitutionsEvent
  >,
): ChatEvent[] =>
  (events ?? []).reduce<ChatEvent[]>((acc, event) => {
    if (event.type === "workout_created") {
      acc.push(parseWorkoutCreatedEvent(event));
      return acc;
    }
    if (event.type === "routine_created") {
      acc.push(parseRoutineCreatedEvent(event));
      return acc;
    }
    if (event.type === "exercise_substitutions_recommended") {
      acc.push(parseExerciseSubstitutionsEvent(event));
      return acc;
    }
    return acc;
  }, []);
