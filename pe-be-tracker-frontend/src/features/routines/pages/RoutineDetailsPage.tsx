import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Save, Trash2 } from "lucide-react";

import {
  deleteRoutine,
  getRoutine,
  startWorkoutFromRoutine,
  updateRoutine,
} from "@/features/routines/api";
import type { Routine } from "@/features/routines/types";
import { useAuthStore, useGuestStore } from "@/stores";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";

const DATE_LABEL_LOCALE = "en-US";
const DATE_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

const formatSetSummary = (
  reps?: number | null,
  intensity?: number | null,
  unitAbbreviation?: string,
) => {
  const parts: string[] = [];

  if (reps != null) {
    parts.push(`${reps} reps`);
  }

  if (intensity != null) {
    parts.push(unitAbbreviation ? `${intensity} ${unitAbbreviation}` : `${intensity}`);
  }

  return parts.length > 0 ? parts.join(" • ") : "No targets set";
};

const RoutineDetailsPage = () => {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestRoutine = useGuestStore((state) =>
    state.routines.find((routine) => routine.id === routineId),
  );
  const updateGuestRoutine = useGuestStore((state) => state.updateRoutine);
  const deleteGuestRoutine = useGuestStore((state) => state.deleteRoutine);
  const addGuestWorkout = useGuestStore((state) => state.addWorkout);
  const createExercisesFromRoutine = useGuestStore(
    (state) => state.createExercisesFromRoutine,
  );
  const guestWorkoutTypes = useGuestStore((state) => state.workoutTypes);

  const {
    data: serverRoutine,
    isPending,
    error,
  } = useQuery({
    queryKey: ["routine", routineId],
    queryFn: () => getRoutine(Number(routineId)),
    enabled: isAuthenticated && !!routineId,
  });

  const routine = useMemo(() => {
    if (isAuthenticated) {
      return serverRoutine ?? null;
    }

    if (!guestRoutine) {
      return null;
    }

    return {
      id: Number(guestRoutine.id),
      name: guestRoutine.name,
      description: guestRoutine.description,
      workout_type_id: 0,
      creator_id: 0,
      created_at: guestRoutine.created_at,
      updated_at: guestRoutine.updated_at,
      exercise_templates: guestRoutine.exercises.map((exercise) => ({
        id: Number(exercise.id),
        exercise_type_id: Number(exercise.exercise_type_id),
        created_at: guestRoutine.created_at,
        updated_at: guestRoutine.updated_at,
        exercise_type: {
          id: Number(exercise.exercise_type.id),
          name: exercise.exercise_type.name,
          description: exercise.exercise_type.description,
          default_intensity_unit: exercise.exercise_type.default_intensity_unit,
          times_used: exercise.exercise_type.times_used,
        },
        set_templates: exercise.sets.map((set) => ({
          id: Number(set.id),
          reps: set.reps,
          intensity: set.intensity,
          intensity_unit_id: set.intensity_unit_id,
          created_at: guestRoutine.created_at,
          updated_at: guestRoutine.updated_at,
          intensity_unit: {
            id: set.intensity_unit_id,
            name: "",
            abbreviation: "",
          },
        })),
      })),
    } satisfies Routine;
  }, [guestRoutine, isAuthenticated, serverRoutine]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!routine) return;
    setName(routine.name);
    setDescription(routine.description ?? "");
  }, [routine]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!routine) {
        throw new Error("Routine not found");
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        workout_type_id: routine.workout_type_id,
      };

      if (isAuthenticated) {
        return updateRoutine(routine.id, payload);
      }

      updateGuestRoutine(String(routine.id), {
        name: payload.name,
        description: payload.description ?? undefined,
      });
      return null;
    },
    onSuccess: async () => {
      if (!routineId) return;
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      await queryClient.invalidateQueries({ queryKey: ["routine", routineId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!routine) {
        throw new Error("Routine not found");
      }

      if (isAuthenticated) {
        await deleteRoutine(routine.id);
        return;
      }

      deleteGuestRoutine(String(routine.id));
    },
    onSuccess: () => {
      navigate("/routines");
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!routine) {
        throw new Error("Routine not found");
      }

      if (isAuthenticated) {
        return startWorkoutFromRoutine(routine.id);
      }

      if (guestWorkoutTypes.length === 0) {
        throw new Error("No workout types available");
      }

      const defaultWorkoutType =
        guestWorkoutTypes.find((type) => type.id === "8") ?? guestWorkoutTypes[0];
      const workoutName = `${routine.name} - ${new Date().toLocaleDateString(
        DATE_LABEL_LOCALE,
        DATE_LABEL_OPTIONS,
      )}`;
      const newWorkoutId = addGuestWorkout({
        name: workoutName,
        notes: null,
        start_time: new Date().toISOString(),
        end_time: null,
        workout_type_id: defaultWorkoutType.id,
        workout_type: defaultWorkoutType,
        exercises: [],
      });

      if (guestRoutine) {
        createExercisesFromRoutine(guestRoutine, newWorkoutId);
      }

      return { id: newWorkoutId };
    },
    onSuccess: (result) => {
      if (!result) return;
      navigate(`/workouts/${result.id}`);
    },
  });

  const hasMetadataChanges =
    !!routine &&
    (name !== routine.name || description !== (routine.description ?? ""));

  const handleDelete = () => {
    if (!routine) return;
    const confirmed = window.confirm(
      `Delete routine "${routine.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    deleteMutation.mutate();
  };

  if (isAuthenticated && isPending) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading routine...
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((isAuthenticated && error) || !routine) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertTitle>Routine unavailable</AlertTitle>
          <AlertDescription>
            We couldn&apos;t load this routine. It may have been deleted or you may
            not have access to it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-2 text-center md:p-4 lg:p-8">
      <div className="bg-card text-card-foreground mx-auto mt-2 max-w-3xl rounded-lg p-2 shadow-lg md:mt-4 md:p-4 lg:mt-8 lg:p-6">
        <div className="mb-4 flex items-center gap-4 text-left">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Go back"
            className="lg:hidden"
          >
            <Link to="/routines">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold md:text-3xl">
              Routine Details
            </h1>
            <p className="text-muted-foreground text-sm">
              Template structure only. Exercise targets are shown from
              `exercise_templates` and `set_templates`.
            </p>
          </div>
        </div>

        <div className="grid gap-4 text-left">
          <Card>
            <CardHeader>
              <CardTitle>Routine Info</CardTitle>
              <CardDescription>
                Update routine metadata here. Nested template editing will be
                wired to the routine update API next.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="routine-name" className="text-sm font-medium">
                  Routine Name
                </label>
                <Input
                  id="routine-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter routine name"
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="routine-description"
                  className="text-sm font-medium"
                >
                  Description
                </label>
                <Textarea
                  id="routine-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional routine description"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!name.trim() || !hasMetadataChanges || saveMutation.isPending}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? "Saving..." : "Save Routine"}
                </Button>
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  variant="outline"
                  className="flex-1"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {startMutation.isPending ? "Starting..." : "Start Workout"}
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleteMutation.isPending ? "Deleting..." : "Delete Routine"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exercise Templates</CardTitle>
              <CardDescription>
                {routine.exercise_templates.length} exercise
                {routine.exercise_templates.length !== 1 ? "s" : ""} in this
                routine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {routine.exercise_templates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No exercise templates have been added to this routine yet.
                </div>
              ) : (
                routine.exercise_templates.map((template, templateIndex) => (
                  <div
                    key={template.id}
                    className="rounded-lg border bg-muted/30 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">
                          {templateIndex + 1}.{" "}
                          {template.exercise_type?.name ?? "Unnamed Exercise"}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {template.set_templates.length} set
                          {template.set_templates.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {template.set_templates.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No targets defined yet.
                        </div>
                      ) : (
                        template.set_templates.map((setTemplate, setIndex) => (
                          <div
                            key={setTemplate.id}
                            className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            <span className="font-medium">Set {setIndex + 1}</span>
                            <span className="text-muted-foreground">
                              {formatSetSummary(
                                setTemplate.reps,
                                setTemplate.intensity,
                                setTemplate.intensity_unit?.abbreviation,
                              )}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoutineDetailsPage;
