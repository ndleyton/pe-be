import { memo, useState } from "react";
import { Exercise } from "@/features/exercises/api";
import { Dumbbell } from "lucide-react";
import ExerciseRow from "../ExerciseRow";
import { LoadingThrobber } from "@/shared/components/ui/LoadingThrobber";

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
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());

  const handleToggleExpand = (exerciseId: string | number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  };

  return (
    <div className="">
      {status === "pending" && <LoadingThrobber />}

      {status === "error" && (
        <div className="text-destructive py-4 text-center">
          Failed to load exercises
        </div>
      )}

      {status === "success" && exercises.length === 0 && (
        <div className="flex flex-col items-center justify-center space-y-6 py-12">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border/20 bg-card/40 shadow-2xl backdrop-blur-md">
            <Dumbbell className="text-muted-foreground/30 h-10 w-10" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-foreground/40 text-sm font-black uppercase tracking-[0.2em]">
              No Exercises Yet
            </p>
            <p className="text-muted-foreground text-xs font-medium opacity-60">
              Click below to add your first exercise
            </p>
          </div>
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
              isExpanded={expandedIds.has(exercise.id)}
              onToggleExpand={() => handleToggleExpand(exercise.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(ExerciseList);
