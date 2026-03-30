import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores";
import { Exercise, updateExerciseSet } from "@/features/exercises/api";
import { createRoutine, type CreateRoutineData } from "@/features/routines/api";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/components/ui/sheet";

interface SaveRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutName: string;
  exercises: Exercise[];
  workoutId?: string;
  workoutTypeId?: number | string | null;
}

export const SaveRoutineModal: React.FC<SaveRoutineModalProps> = ({
  isOpen,
  onClose,
  workoutName,
  exercises,
  workoutId,
  workoutTypeId,
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();
  const [routineName, setRoutineName] = useState(workoutName || "My Routine");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const updateExerciseSetsDoneStatus = async () => {
    if (!isAuthenticated) return;
    const setsToUpdate = exercises.flatMap((exercise) =>
      exercise.exercise_sets
        .filter((set) => Boolean(set.id))
        .map((set) => ({ id: set.id, done: set.done })),
    );

    const results = await Promise.allSettled(
      setsToUpdate.map((set) => updateExerciseSet(set.id, { done: set.done })),
    );

    // Best-effort update: log failures but do not block routine creation
    results.forEach((res, idx) => {
      if (res.status === "rejected") {
        // eslint-disable-next-line no-console
        console.warn("Failed to update exercise set done status", {
          setId: setsToUpdate[idx]?.id,
          error: res.reason,
        });
      }
    });
  };

  const handleSave = async () => {
    if (!routineName.trim()) return;
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      if (workoutTypeId == null) {
        throw new Error("Workout type is required to save a routine");
      }

      await updateExerciseSetsDoneStatus();
      const routineData: CreateRoutineData = {
        name: routineName,
        workout_type_id: Number(workoutTypeId),
        exercise_templates: exercises.map((exercise) => ({
          exercise_type_id: Number(exercise.exercise_type_id),
          set_templates: exercise.exercise_sets.map((set) => ({
            reps: set.reps,
            intensity: set.intensity,
            intensity_unit_id: Number(set.intensity_unit_id),
          })),
        })),
      };
      await createRoutine(routineData);
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      if (workoutId) {
        queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
      }

      // Show success message
      setShowSuccess(true);

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        setShowSuccess(false);
        setRoutineName("");
      }, 2000);
    } catch (error) {
      console.error("Error saving routine:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
    setRoutineName(workoutName || "My Routine");
    setShowSuccess(false);
  };

  const exerciseCount = exercises.length;
  const totalSets = exercises.reduce(
    (total, exercise) => total + exercise.exercise_sets.length,
    0,
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleCancel}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {showSuccess ? "Routine Saved!" : "Save as Routine"}
          </SheetTitle>
          <SheetDescription>
            {showSuccess
              ? `"${routineName}" has been saved successfully and is ready to use for quick starts.`
              : `Create a reusable routine from this workout with ${exerciseCount} exercise${exerciseCount !== 1 ? "s" : ""} and ${totalSets} set${totalSets !== 1 ? "s" : ""}.`}
          </SheetDescription>
        </SheetHeader>

        {showSuccess ? (
          <div className="flex flex-col items-center justify-center px-4 py-8">
            <div className="bg-done/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <svg
                className="text-done h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-muted-foreground text-center">
              You can now find this routine in your Quick Start section.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 px-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="routine-name" className="text-sm font-medium">
                  Routine Name
                </label>
                <Input
                  id="routine-name"
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  placeholder="Enter routine name"
                />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <h4 className="mb-2 text-sm font-medium">
                  Exercises to include:
                </h4>
                <div className="space-y-1">
                  {exercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className="text-muted-foreground text-sm"
                    >
                      {exercise.exercise_type.name} •{" "}
                      {exercise.exercise_sets.length} set
                      {exercise.exercise_sets.length !== 1 ? "s" : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2 px-4 pb-6">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !routineName.trim() ||
                  isLoading ||
                  !isAuthenticated ||
                  workoutTypeId == null
                }
                className="flex-1"
              >
                {isLoading ? "Saving..." : "Save Routine"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
