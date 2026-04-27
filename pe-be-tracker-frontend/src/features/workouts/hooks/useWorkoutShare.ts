import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ProfileMe } from "@/features/profile/types";
import { updateWorkout } from "@/features/workouts/api";
import type { Workout } from "@/features/workouts/types";

interface UseWorkoutShareParams {
  profile?: ProfileMe | null;
  workoutId?: string;
  serverWorkout?: Workout;
  workoutName?: string | null;
  queryClient: QueryClient;
}

export const useWorkoutShare = ({
  profile,
  workoutId,
  serverWorkout,
  workoutName,
  queryClient,
}: UseWorkoutShareParams) => {
  const share = useCallback(async () => {
    if (!profile?.username || !workoutId) return;

    if (serverWorkout?.visibility !== "public") {
      try {
        await updateWorkout(workoutId, { visibility: "public" });
        await queryClient.invalidateQueries({ queryKey: ["workout", workoutId] });
      } catch {
        toast.error("Could not set workout to public.");
        return;
      }
    }

    const url = `${window.location.origin}/u/${profile.username}/activities/${workoutId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Workout: ${workoutName || "Workout"}`,
          url,
        });
        toast.success("Workout shared!");
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Workout link copied to clipboard!");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Failed to share workout.");
      }
    }
  }, [profile?.username, queryClient, serverWorkout?.visibility, workoutId, workoutName]);

  return { share };
};
