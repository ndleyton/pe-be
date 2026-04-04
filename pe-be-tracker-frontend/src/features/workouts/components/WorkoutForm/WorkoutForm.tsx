import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Routine } from "@/features/routines/types";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import {
  toUTCISOString,
  toLocalDateTimeInputValue,
  getCurrentUTCTimestamp,
} from "@/utils/date";
import WorkoutTypeModal, { WorkoutType, fetchWorkoutTypes } from "../WorkoutTypeModal/WorkoutTypeModal";
import {
  useGuestStore,
  useAuthStore,
  GuestWorkoutType,
} from "@/stores";
import { Button } from "@/shared/components/ui/button";

interface WorkoutFormData {
  name?: string;
  notes?: string;
  start_time: string;
  end_time?: string;
  workout_type_id: number | string; // Can be number (server) or string (guest)
}

interface WorkoutFormProps {
  onWorkoutCreated: (newWorkoutId: number | string) => void; // Can be number (server) or string (guest)
  routine?: Routine | null;
}

const createWorkout = async (data: WorkoutFormData) => {
  const startTimeISO = data.start_time ? toUTCISOString(data.start_time) : null;
  const endTimeISO = data.end_time ? toUTCISOString(data.end_time) : null;

  const response = await api.post(endpoints.workouts, {
    name: data.name || null,
    notes: data.notes || null,
    start_time: startTimeISO || null,
    end_time: endTimeISO || null,
    workout_type_id: data.workout_type_id,
  });
  return response.data;
};

const WorkoutForm: React.FC<WorkoutFormProps> = ({
  onWorkoutCreated,
  routine,
}) => {
  const navigate = useNavigate();
  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<
    WorkoutType | GuestWorkoutType | null
  >(null);
  const [isEditingName, setIsEditingName] = useState(false);

  const { data: serverWorkoutTypes = [] } = useQuery({
    queryKey: ["workoutTypes"],
    queryFn: fetchWorkoutTypes,
    enabled: isAuthenticated,
  });

  const { register, handleSubmit, reset, formState, setValue, watch } =
    useForm<WorkoutFormData>({
      defaultValues: {
        name: routine
          ? `${routine.name} - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        start_time: toLocalDateTimeInputValue(),
        workout_type_id: !isAuthenticated ? "" : undefined, // Initialize for guest users
      },
    });

  const nameField = watch("name");
  const datePrefix = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    [],
  );

  // Set initial workout type based on default form value
  useEffect(() => {
    if (selectedWorkoutType) return;

    if (!isAuthenticated) {
      if (guestData.workoutTypes.length > 0) {
        // Try strength training, then other, then first
        const defaultWorkoutType =
          guestData.workoutTypes.find((wt) => wt.name === "Strength Training") ||
          guestData.workoutTypes.find((wt) => wt.name === "Other") ||
          guestData.workoutTypes[0];

        if (defaultWorkoutType) {
          setSelectedWorkoutType(defaultWorkoutType);
          setValue("workout_type_id", defaultWorkoutType.id);
        }
      }
    } else {
      if (serverWorkoutTypes.length > 0) {
        const defaultWorkoutType =
          serverWorkoutTypes.find((wt) => wt.name === "Strength Training") ||
          serverWorkoutTypes[0];

        if (defaultWorkoutType) {
          setSelectedWorkoutType(defaultWorkoutType);
          setValue("workout_type_id", defaultWorkoutType.id);
        }
      }
    }
  }, [selectedWorkoutType, isAuthenticated, guestData.workoutTypes, serverWorkoutTypes, setValue]);

  useEffect(() => {
    if (
      selectedWorkoutType &&
      (!formState.dirtyFields.name || nameField === datePrefix)
    ) {
      setValue("name", `${selectedWorkoutType.name} - ${datePrefix}`);
    }
  }, [
    selectedWorkoutType,
    datePrefix,
    formState.dirtyFields.name,
    nameField,
    setValue,
  ]);

  useEffect(() => {
    if (routine) {
      reset({
        name: `${routine.name} - ${datePrefix}`,
        start_time: toLocalDateTimeInputValue(),
      });
    }
  }, [routine, datePrefix, reset]);

  const mutation = useMutation({
    mutationFn: createWorkout,
    onSuccess: (data) => {
      const newWorkoutId = data.id;
      resetForm();
      onWorkoutCreated(newWorkoutId);
      navigate(`/workouts/${newWorkoutId}`);
    },
  });

  const onSubmit = (data: WorkoutFormData) => {
    if (isAuthenticated) {
      // Use API for authenticated users
      mutation.mutate(data);
    } else {
      // Use guest context for unauthenticated users
      let workoutType = guestData.workoutTypes.find(
        (wt) => wt.id === data.workout_type_id,
      );
      if (!workoutType) {
        // Fallback to default workout type if not found
        workoutType =
          guestData.workoutTypes.find((wt) => wt.name === "Other") ||
          guestData.workoutTypes[guestData.workoutTypes.length - 1];
        if (!workoutType) {
          console.error("No workout types available");
          return;
        }
        // Update the form with the fallback workout type
        setValue("workout_type_id", workoutType.id);
      }

      const startTimeISO = getCurrentUTCTimestamp();
      const endTimeISO = data.end_time ? toUTCISOString(data.end_time) : null;

      const newWorkoutId = guestActions.addWorkout({
        name: data.name || null,
        notes: data.notes || null,
        start_time: startTimeISO,
        end_time: endTimeISO,
        workout_type_id: data.workout_type_id as string,
        workout_type: workoutType,
        exercises: [],
      });

      // If there's a routine, create exercises from it
      if (routine) {
        guestActions.createExercisesFromRoutine(routine, newWorkoutId);
      }

      resetForm();
      onWorkoutCreated(newWorkoutId);
      navigate(`/workouts/${newWorkoutId}`);
    }
  };

  const handleWorkoutTypeSelect = (
    workoutType: WorkoutType | GuestWorkoutType,
  ) => {
    setSelectedWorkoutType(workoutType);
    setValue("workout_type_id", workoutType.id);
    setShowModal(false);
  };

  const resetForm = () => {
    reset();
    setSelectedWorkoutType(null);
    setIsEditingName(false);
    setValue("start_time", toLocalDateTimeInputValue());

    // Immediately set a default workout type after reset
    setTimeout(() => {
      if (!isAuthenticated) {
        if (guestData.workoutTypes.length > 0) {
          const defaultWorkoutType =
            guestData.workoutTypes.find((wt) => wt.name === "Strength Training") ||
            guestData.workoutTypes.find((wt) => wt.name === "Other") ||
            guestData.workoutTypes[0];
          if (defaultWorkoutType) {
            setSelectedWorkoutType(defaultWorkoutType);
            setValue("workout_type_id", defaultWorkoutType.id);
          }
        }
      } else {
        if (serverWorkoutTypes.length > 0) {
          const defaultWorkoutType =
            serverWorkoutTypes.find((wt) => wt.name === "Strength Training") ||
            serverWorkoutTypes[0];
          if (defaultWorkoutType) {
            setSelectedWorkoutType(defaultWorkoutType);
            setValue("workout_type_id", defaultWorkoutType.id);
          }
        }
      }
    }, 0);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full space-y-5 py-2"
    >
      {routine && (
        <div className="bg-primary/10 border-primary/20 mb-4 rounded-lg border p-3">
          <div className="mb-2 flex items-center space-x-2">
            <span className="text-primary text-sm font-medium">
              📋 Starting from Routine
            </span>
          </div>
          <div className="text-muted-foreground text-sm">
            {routine.exercise_templates.length} exercise
            {routine.exercise_templates.length !== 1 ? "s" : ""} •{" "}
            {routine.exercise_templates.reduce(
              (total, ex) => total + ex.set_templates.length,
              0,
            )}{" "}
            set
            {routine.exercise_templates.reduce(
              (total, ex) => total + ex.set_templates.length,
              0,
            ) !== 1
              ? "s"
              : ""}
          </div>
        </div>
      )}
      <div className="mb-6">
        {isEditingName ? (
          <div className="flex items-center space-x-2">
            <input
              type="text"
              {...register("name")}
              data-testid="workout-name-input"
              className="bg-background text-foreground border-border focus:ring-ring flex-1 rounded border px-2 py-1.5 text-base focus:ring-2 focus:outline-none sm:px-3 sm:py-2 sm:text-sm"
              autoFocus
            />
            <Button
              type="button"
              onClick={() => setIsEditingName(false)}
              aria-label="save workout name"
              size="icon"
              className="bg-primary hover:bg-primary/90"
            >
              <svg
                className="h-4 w-4"
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
            </Button>
          </div>
        ) : (
          <div
            onClick={() => setIsEditingName(true)}
            className="group flex cursor-pointer items-center justify-between"
          >
            <h2
              className="text-foreground text-xl font-semibold"
              data-testid="workout-name-heading"
            >
              {nameField || "Workout Name"}
            </h2>
            <svg
              className="text-muted-foreground h-4 w-4 opacity-20 transition-opacity group-hover:opacity-100"
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
        )}
      </div>
      <div>
        <label className="text-foreground mb-1 block font-medium">
          Notes
          <input
            placeholder="How am I feeling today?"
            type="text"
            {...register("notes")}
            data-testid="workout-notes-input"
            className="bg-background text-foreground border-border focus:ring-ring mt-1.5 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </label>
      </div>
      <div>
        <label className="text-foreground mb-1 block font-medium">
          Start Time
          <input
            type="datetime-local"
            {...register("start_time", { required: "Start time is required" })}
            className="bg-background text-foreground border-border focus:ring-ring mt-1.5 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </label>
        {formState.errors.start_time && (
          <div className="text-destructive mt-1 text-xs">
            {formState.errors.start_time.message}
          </div>
        )}
      </div>
      <div>
        <label className="text-foreground mb-1.5 block font-medium">
          Workout Type
        </label>
        {selectedWorkoutType ? (
          <div
            onClick={() => setShowModal(true)}
            className="group bg-card/60 border-border/50 hover:bg-accent/60 hover:border-primary/30 cursor-pointer rounded-2xl border p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
            data-testid="open-workout-type-modal"
          >
            <div className="flex items-center space-x-4">
              <div className="relative bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl font-bold text-xl shadow-inner group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-tr from-primary/20 to-transparent group-hover:opacity-0 transition-opacity" />
                <span className="relative z-10">{selectedWorkoutType.name.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <h4 className="text-foreground font-bold text-base leading-tight">
                  {selectedWorkoutType.name}
                </h4>
                <p className="text-muted-foreground mt-0.5 text-xs font-medium opacity-80 group-hover:opacity-100">
                  {selectedWorkoutType.description}
                </p>
              </div>
              <div className="text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all">
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
            className="bg-card/40 text-foreground border-border/50 hover:bg-accent/60 w-full justify-start rounded-2xl py-6"
            data-testid="open-workout-type-modal"
          >
            Select Workout Type
          </Button>
        )}
        <input
          type="hidden"
          {...register("workout_type_id", {
            required: "Workout type is required",
            valueAsNumber: isAuthenticated, // Only convert to number if authenticated
          })}
        />
        {formState.errors.workout_type_id && (
          <div className="text-destructive mt-2 text-sm">
            {formState.errors.workout_type_id.message}
          </div>
        )}
      </div>
      <Button
        type="submit"
        disabled={isAuthenticated && mutation.isPending}
        className="bg-primary/90 hover:bg-primary w-full rounded-2xl py-7 text-lg font-black tracking-tight shadow-2xl shadow-primary/20 backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95 border border-white/10"
        data-testid="start-workout-button"
      >
        {isAuthenticated && mutation.isPending
          ? "Creating..."
          : "Start Workout"}
      </Button>
      {isAuthenticated && mutation.error && (
        <div className="text-destructive text-center text-sm font-medium">
          Failed to create workout.
        </div>
      )}

      <WorkoutTypeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handleWorkoutTypeSelect}
      />
    </form>
  );
};

export default WorkoutForm;
