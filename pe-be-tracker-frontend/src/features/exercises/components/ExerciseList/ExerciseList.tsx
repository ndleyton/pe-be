
import { memo } from "react";
import { Exercise } from "@/features/exercises/api";
import ExerciseRow from "../ExerciseRow";
import { ExerciseListSkeleton } from "@/shared/components/skeletons/ExerciseListSkeleton";

interface ExerciseListProps {
  exercises: Exercise[];
  status: "idle" | "pending" | "success" | "error";
  workoutId?: string;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
  onExerciseDelete?: (exerciseId: number | string) => void;
}

const ExerciseList: React.FC<ExerciseListProps> = ({
  exercises,
  status,
  workoutId,
  onExerciseUpdate,
  onExerciseDelete,
}) => {
  return (
    <div className="mt-8">
      {status === "pending" && <ExerciseListSkeleton />}

      {status === "error" && (
        <div className="text-destructive py-4 text-center">
          Failed to load exercises
        </div>
      )}

      {status === "success" && exercises.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          No exercises added yet. Click below to add your first exercise.
        </div>
      )}

      {exercises.length > 0 && (
        <div className="space-y-4">
          {exercises.map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              workoutId={workoutId}
              onExerciseUpdate={onExerciseUpdate}
              onExerciseDelete={onExerciseDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(ExerciseList);
