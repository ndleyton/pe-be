import { useLocation } from "react-router-dom";
import type { WorkoutPageLocationState } from "@/features/workouts/hooks/useWorkoutPageData";
import { ExerciseListSkeleton } from "@/shared/components/skeletons/ExerciseListSkeleton";
import { Skeleton } from "@/shared/components/ui/skeleton";

const WorkoutPageSkeleton = () => {
  const location = useLocation();
  const routeState = location.state as WorkoutPageLocationState | null;
  const knownEmptyExercises = Boolean(routeState?.knownEmptyExercises);

  return (
    <div
      className="mx-auto min-h-screen max-w-4xl px-4 py-6 text-center md:py-8"
      role="status"
      aria-label="Loading workout"
    >
      <span className="sr-only">Loading workout</span>
      <div className="mb-8 flex items-center gap-4 text-left">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-primary/5" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="h-10 w-48 rounded-xl md:w-60" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <div className="space-y-6">
        {knownEmptyExercises ? (
          <Skeleton className="mx-auto h-28 w-full max-w-md rounded-2xl" />
        ) : (
          <ExerciseListSkeleton count={2} />
        )}

        <Skeleton className="mt-8 mb-4 h-px w-full bg-primary/20" />
        <div className="flex items-center justify-center pb-24">
          <Skeleton className="h-14 w-40 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default WorkoutPageSkeleton;
