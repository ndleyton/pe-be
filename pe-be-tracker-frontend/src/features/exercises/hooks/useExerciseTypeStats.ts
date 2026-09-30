import { useQuery } from "@tanstack/react-query";
import { getExerciseTypeStats, type ExerciseType } from "@/features/exercises/api";
import { useAuthStore } from "@/stores/useAuthStore";

export const useExerciseTypeStats = (exerciseTypeId: string | number, _exerciseType?: ExerciseType) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const {
    data: stats,
    isLoading: loading,
    error,
    refetch: updateStats,
  } = useQuery({
    queryKey: ["exerciseTypeStats", exerciseTypeId, 2],
    queryFn: () => getExerciseTypeStats(String(exerciseTypeId), 2),
    enabled: isAuthenticated && (typeof exerciseTypeId === "number" || typeof exerciseTypeId === "string"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    stats,
    updateStats,
    loading,
    error,
  };
};
