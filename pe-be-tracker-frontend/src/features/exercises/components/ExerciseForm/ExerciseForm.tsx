import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { usePostHog } from "posthog-js/react";
import { useMutation } from "@tanstack/react-query";
import ExerciseTypeModal from "../ExerciseTypeModal";
import { ExerciseType, createExercise } from "@/features/exercises/api";
import { useGuestStore, useAuthStore, GuestExerciseType } from "@/stores";
import { Button } from "@/shared/components/ui/button";

interface ExerciseFormData {
  exercise_type_id: number | string; // Can be number (server) or string (guest)
  timestamp?: string;
  notes?: string;
}

interface ExerciseFormProps {
  workoutId: string;
  onExerciseCreated: () => void;
}

const ExerciseForm: React.FC<ExerciseFormProps> = ({
  workoutId,
  onExerciseCreated,
}) => {
  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedExerciseType, setSelectedExerciseType] = useState<
    ExerciseType | GuestExerciseType | null
  >(null);
  const formRef = useRef<HTMLFormElement>(null);
  const posthog = usePostHog();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<ExerciseFormData>();

  const mutation = useMutation({
    mutationFn: (data: ExerciseFormData) =>
      createExercise({ ...data, workout_id: Number(workoutId) }),
    onSuccess: () => {
      reset();
      setSelectedExerciseType(null);
      onExerciseCreated();
    },
  });

  const onSubmit = (data: ExerciseFormData) => {
    if (isAuthenticated) {
      // Ensure numeric IDs for server payload
      const numericExerciseTypeId = Number(data.exercise_type_id);
      const numericWorkoutId = Number(workoutId);

      if (!Number.isFinite(numericWorkoutId) || numericWorkoutId <= 0) {
        const error = new Error(
          `Invalid workout id for ExerciseForm: ${workoutId}`,
        );
        console.error(error);
        // Feed handled error into PostHog error tracking with context
        posthog?.captureException(error, {
          source: "exercise-form",
          reason: "invalid_workout_id",
          workoutId,
          exercise_type_id: numericExerciseTypeId,
          isAuthenticated: true,
          path: typeof window !== "undefined" ? window.location.pathname : "",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      mutation.mutate({
        ...data,
        exercise_type_id: numericExerciseTypeId,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Use guest context for unauthenticated users
      const exerciseType = guestData.exerciseTypes.find(
        (et) => et.id === data.exercise_type_id,
      );
      if (!exerciseType) {
        console.error("Exercise type not found:", data.exercise_type_id);
        return;
      }

      guestActions.addExercise({
        exercise_type_id: data.exercise_type_id as string,
        workout_id: workoutId,
        timestamp: new Date().toISOString(),
        notes: data.notes || null,
        exercise_type: exerciseType,
      });

      reset();
      setSelectedExerciseType(null);
      onExerciseCreated();
    }
  };

  const handleExerciseTypeSelect = (
    exerciseType: ExerciseType | GuestExerciseType,
  ) => {
    setSelectedExerciseType(exerciseType);
    setValue("exercise_type_id", exerciseType.id, { shouldValidate: true });
    clearErrors("exercise_type_id");
    setShowModal(false);

    // Scroll form into view after modal closes
    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onSubmit)}
      className="border-border bg-card text-card-foreground mx-auto mb-6 w-full max-w-lg rounded-lg border p-4 shadow"
    >
      <h2 className="mb-4 text-lg font-semibold">Add Exercise</h2>
      <div className="mb-4">
        {selectedExerciseType ? (
          <div
            onClick={() => setShowModal(true)}
            className="bg-background border-border hover:bg-accent cursor-pointer rounded-lg border p-4 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-lg">
                <span className="text-primary-foreground font-bold">
                  {selectedExerciseType.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-foreground font-medium">
                  {selectedExerciseType.name}
                </h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  {selectedExerciseType.description}
                </p>
              </div>
              <div className="text-muted-foreground">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => setShowModal(true)}
            variant="outline"
            className="bg-background text-foreground border-border hover:bg-accent w-full justify-start"
          >
            Select Exercise
          </Button>
        )}
        <input
          type="hidden"
          {...register("exercise_type_id", {
            required: "Exercise is required",
            valueAsNumber: isAuthenticated, // Only convert to number if authenticated
          })}
        />
        {errors.exercise_type_id && (
          <div className="text-destructive mt-2 text-sm">
            {errors.exercise_type_id.message}
          </div>
        )}
      </div>
      <div className="mb-4">
        <label className="text-foreground mb-1 block font-medium">
          Notes:
          <input
            type="text"
            {...register("notes")}
            className="bg-background text-foreground border-border focus:ring-ring mt-1 mb-2 w-full rounded border px-3 py-2 focus:ring-2 focus:outline-none"
          />
        </label>
      </div>
      <Button
        type="submit"
        disabled={mutation.isPending}
        className="bg-primary hover:bg-primary/90 mt-2 px-6 py-2"
      >
        {mutation.isPending ? "Adding..." : "Add Exercise"}
      </Button>
      {isAuthenticated && mutation.error && (
        <div className="text-destructive mt-3">Failed to create exercise.</div>
      )}

      <ExerciseTypeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handleExerciseTypeSelect}
      />
    </form>
  );
};

export default ExerciseForm;
