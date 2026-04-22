import { useQuery } from "@tanstack/react-query";

import {
  getSimilarExerciseTypes,
  type SimilarExercisesResponse,
} from "@/features/exercises/api";

const EMPTY_SIMILAR_EXERCISES: SimilarExercisesResponse = {
  data: [],
  strategy: "same_primary_muscle_then_group_by_times_used",
};

export const useSimilarExercises = (
  exerciseTypeId?: string | number,
  limit: number = 3,
) => {
  const query = useQuery({
    queryKey: ["similarExercises", exerciseTypeId, limit],
    queryFn: () => getSimilarExerciseTypes(exerciseTypeId!, limit),
    enabled: exerciseTypeId !== undefined && exerciseTypeId !== null,
  });

  return {
    similarExercises: query.data ?? EMPTY_SIMILAR_EXERCISES,
    isLoading: query.isLoading,
    error: query.error,
  };
};
