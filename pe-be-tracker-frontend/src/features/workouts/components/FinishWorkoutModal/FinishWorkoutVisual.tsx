import AnatomicalImage from "./AnatomicalImage";
import type { WorkoutPhoto } from "@/features/workouts/types";
import type { MuscleGroupSummary } from "@/utils/muscleGroups";

interface FinishWorkoutVisualProps {
  isUploadingWorkoutPhoto?: boolean;
  muscleGroupSummary: MuscleGroupSummary[];
  workoutName?: string;
  workoutPhoto?: WorkoutPhoto | null;
  workoutPhotoPreviewUrl?: string | null;
}

const FinishWorkoutVisual = ({
  isUploadingWorkoutPhoto = false,
  muscleGroupSummary,
  workoutName,
  workoutPhoto,
  workoutPhotoPreviewUrl,
}: FinishWorkoutVisualProps) => {
  const imageUrl = workoutPhotoPreviewUrl || workoutPhoto?.url || null;
  const visualFrameClassName = imageUrl
    ? "aspect-square w-full"
    : "aspect-[1065/827] w-full";

  return (
    <div className="relative mb-3 overflow-hidden rounded-[2.5rem] border border-border/20 bg-muted/10 shadow-inner">
      <div className={visualFrameClassName}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Workout photo for ${workoutName ?? "workout"}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <AnatomicalImage muscleGroupSummary={muscleGroupSummary} />
        )}
      </div>
      {isUploadingWorkoutPhoto ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-sm">
          <span className="rounded-full border border-border/60 bg-background/90 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-foreground/80">
            Uploading photo...
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default FinishWorkoutVisual;
