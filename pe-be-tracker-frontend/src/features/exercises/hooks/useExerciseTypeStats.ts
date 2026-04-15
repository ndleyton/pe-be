import { useQuery } from "@tanstack/react-query";
import { getExerciseTypeStats, type ExerciseTypeStats } from "@/features/exercises/api";
import { useAuthStore } from "@/stores/useAuthStore";

export const useExerciseTypeStats = (exerciseTypeId: string | number) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["exerciseTypeStats", exerciseTypeId],
    queryFn: () => getExerciseTypeStats(String(exerciseTypeId)),
    enabled: isAuthenticated && (typeof exerciseTypeId === "number" || typeof exerciseTypeId === "string"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    stats,
    isLoading,
    error,
    refetch,
  };
};
