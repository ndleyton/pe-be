import {
  type ChatApiExerciseSubstitutionsEvent,
  type ChatApiRoutineCreatedEvent,
  type ChatApiRoutineProgramRecommendedEvent,
  type ChatApiRoutineRecommendedEvent,
  type ChatApiWorkoutCreatedEvent,
  type ChatEvent,
  type ExerciseSubstitutionsEvent,
  type RoutineCreatedEvent,
  type RoutineProgramRecommendedEvent,
  type RoutineRecommendedEvent,
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

export const parseRoutineRecommendedEvent = (
  event: ChatApiRoutineRecommendedEvent,
): RoutineRecommendedEvent => {
  return {
    type: "routine_recommended",
    title: event.title ?? undefined,
    query: event.query,
    recommendations: event.recommendations.map((recommendation) => ({
      id: recommendation.id,
      name: recommendation.name,
      description: recommendation.description,
      author: recommendation.author,
      category: recommendation.category,
      exerciseCount: recommendation.exercise_count,
      setCount: recommendation.set_count,
      exerciseNamesPreview: recommendation.exercise_names_preview,
      score: recommendation.score,
      reason: recommendation.reason,
    })),
  };
};

export const parseRoutineProgramRecommendedEvent = (
  event: ChatApiRoutineProgramRecommendedEvent,
): RoutineProgramRecommendedEvent => {
  return {
    type: "routine_program_recommended",
    title: event.title ?? undefined,
    query: event.query,
    recommendations: event.recommendations.map((recommendation) => ({
      id: recommendation.id,
      name: recommendation.name,
      description: recommendation.description,
      author: recommendation.author,
      category: recommendation.category,
      sourceLabel: recommendation.source_label,
      dayCount: recommendation.day_count,
      routineCount: recommendation.routine_count,
      dayLabelsPreview: recommendation.day_labels_preview,
      score: recommendation.score,
      reason: recommendation.reason,
    })),
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
    | ChatApiRoutineRecommendedEvent
    | ChatApiRoutineProgramRecommendedEvent
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
    if (event.type === "routine_recommended") {
      acc.push(parseRoutineRecommendedEvent(event));
      return acc;
    }
    if (event.type === "routine_program_recommended") {
      acc.push(parseRoutineProgramRecommendedEvent(event));
      return acc;
    }
    if (event.type === "exercise_substitutions_recommended") {
      acc.push(parseExerciseSubstitutionsEvent(event));
      return acc;
    }
    return acc;
  }, []);
