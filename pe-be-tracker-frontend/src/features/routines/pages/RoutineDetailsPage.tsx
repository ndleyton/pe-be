import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  deleteRoutine,
  getRoutine,
  startWorkoutFromRoutine,
  updateRoutine,
  type RoutineTemplatePayload,
} from "@/features/routines/api";
import type { Routine } from "@/features/routines/types";
import {
  getIntensityUnits,
  type ExerciseType,
  type IntensityUnit,
} from "@/features/exercises/api";
import { GUEST_INTENSITY_UNITS } from "@/features/exercises/constants";
import {
  ExerciseTypeModal,
  IntensityUnitModal,
} from "@/features/exercises/components";
import {
  useAuthStore,
  useGuestStore,
  type GuestExerciseType,
  type GuestIntensityUnit,
  type GuestRoutine,
  type GuestRoutineExercise,
  type GuestRoutineSet,
} from "@/stores";
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
import { parseDecimalInput } from "@/utils/format";

const DATE_LABEL_LOCALE = "en-US";
const DATE_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

const guestIntensityUnits: GuestIntensityUnit[] = [...GUEST_INTENSITY_UNITS];

type RoutineExerciseTypeOption = {
  id: string | number;
  name: string;
  description: string | null;
  default_intensity_unit: number;
  times_used: number;
};

type RoutineIntensityUnitOption = Pick<
  GuestIntensityUnit,
  "id" | "name" | "abbreviation"
>;

type RoutineEditorSet = {
  id: string;
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  intensity_unit: RoutineIntensityUnitOption | null;
};

type RoutineEditorTemplate = {
  id: string;
  exercise_type_id: number | null;
  exercise_type: RoutineExerciseTypeOption | null;
  set_templates: RoutineEditorSet[];
};

type ExercisePickerTarget =
  | { mode: "add" }
  | { mode: "replace"; templateId: string };

type UnitPickerTarget = {
  templateId: string;
  setId: string;
};

const createTempId = () =>
  `temp-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

const toRoutineExerciseTypeOption = (
  exerciseType:
    | ExerciseType
    | GuestExerciseType
    | Routine["exercise_templates"][number]["exercise_type"]
    | null
    | undefined,
): RoutineExerciseTypeOption | null => {
  if (!exerciseType) return null;

  return {
    id: exerciseType.id,
    name: exerciseType.name,
    description: exerciseType.description ?? null,
    default_intensity_unit: Number(exerciseType.default_intensity_unit ?? 1),
    times_used: exerciseType.times_used ?? 0,
  };
};

const toRoutineIntensityUnitOption = (
  intensityUnit:
    | IntensityUnit
    | GuestIntensityUnit
    | Routine["exercise_templates"][number]["set_templates"][number]["intensity_unit"]
    | null
    | undefined,
): RoutineIntensityUnitOption | null => {
  if (!intensityUnit) return null;

  return {
    id: intensityUnit.id,
    name: intensityUnit.name,
    abbreviation: intensityUnit.abbreviation,
  };
};

const findIntensityUnitById = (
  units: RoutineIntensityUnitOption[],
  id: number,
) => {
  return units.find((unit) => unit.id === id) ?? null;
};

const formatSetSummary = (setTemplate: RoutineEditorSet) => {
  const parts: string[] = [];

  if (setTemplate.reps != null) {
    parts.push(`${setTemplate.reps} reps`);
  }

  if (setTemplate.intensity != null) {
    const suffix = setTemplate.intensity_unit?.abbreviation
      ? ` ${setTemplate.intensity_unit.abbreviation}`
      : "";
    parts.push(`${setTemplate.intensity}${suffix}`);
  }

  return parts.length > 0 ? parts.join(" • ") : "No targets set";
};

const buildEditorTemplatesFromRoutine = (
  routine: Routine,
  availableUnits: RoutineIntensityUnitOption[],
): RoutineEditorTemplate[] =>
  routine.exercise_templates.map((template) => ({
    id: String(template.id),
    exercise_type_id: template.exercise_type_id,
    exercise_type: toRoutineExerciseTypeOption(template.exercise_type),
    set_templates: template.set_templates.map((setTemplate) => ({
      id: String(setTemplate.id),
      reps: setTemplate.reps ?? null,
      intensity: setTemplate.intensity ?? null,
      intensity_unit_id: setTemplate.intensity_unit_id,
      intensity_unit:
        toRoutineIntensityUnitOption(setTemplate.intensity_unit) ??
        findIntensityUnitById(availableUnits, setTemplate.intensity_unit_id),
    })),
  }));

const buildRoutinePayload = (
  templates: RoutineEditorTemplate[],
): RoutineTemplatePayload[] =>
  templates.map((template) => ({
    exercise_type_id: Number(template.exercise_type_id),
    set_templates: template.set_templates.map((setTemplate) => ({
      reps: setTemplate.reps,
      intensity: setTemplate.intensity,
      intensity_unit_id: setTemplate.intensity_unit_id,
    })),
  }));

const toGuestRoutineExercises = (
  templates: RoutineEditorTemplate[],
): GuestRoutineExercise[] =>
  templates.map((template) => ({
    id: template.id,
    exercise_type_id: String(template.exercise_type_id),
    exercise_type: {
      id: String(template.exercise_type?.id ?? template.exercise_type_id ?? ""),
      name: template.exercise_type?.name ?? "Custom Exercise",
      description: template.exercise_type?.description ?? null,
      default_intensity_unit: Number(
        template.exercise_type?.default_intensity_unit ??
          template.set_templates[0]?.intensity_unit_id ??
          1,
      ),
      times_used: template.exercise_type?.times_used ?? 0,
    },
    sets: template.set_templates.map(
      (setTemplate): GuestRoutineSet => ({
        id: setTemplate.id,
        reps: setTemplate.reps,
        intensity: setTemplate.intensity,
        intensity_unit_id: setTemplate.intensity_unit_id,
        rest_time_seconds: null,
      }),
    ),
    notes: null,
  }));

const buildComparableSnapshot = (
  name: string,
  description: string,
  templates: RoutineEditorTemplate[],
) =>
  JSON.stringify({
    name,
    description,
    exercise_templates: templates.map((template) => ({
      exercise_type_id: template.exercise_type_id,
      set_templates: template.set_templates.map((setTemplate) => ({
        reps: setTemplate.reps,
        intensity: setTemplate.intensity,
        intensity_unit_id: setTemplate.intensity_unit_id,
      })),
    })),
  });

const createDefaultSet = (
  availableUnits: RoutineIntensityUnitOption[],
  defaultUnitId?: number | null,
): RoutineEditorSet => {
  const fallbackUnit =
    (defaultUnitId != null
      ? findIntensityUnitById(availableUnits, defaultUnitId)
      : null) ?? availableUnits[0] ?? guestIntensityUnits[0];

  return {
    id: createTempId(),
    reps: null,
    intensity: null,
    intensity_unit_id: fallbackUnit.id,
    intensity_unit: fallbackUnit,
  };
};

const toRoutineFromGuest = (guestRoutine: GuestRoutine): Routine => ({
  id: Number.parseInt(guestRoutine.id, 10) || 0,
  name: guestRoutine.name,
  description: guestRoutine.description ?? null,
  workout_type_id: 0,
  creator_id: 0,
  created_at: guestRoutine.created_at,
  updated_at: guestRoutine.updated_at,
  exercise_templates: guestRoutine.exercises.map((exercise) => ({
    id: Number.parseInt(exercise.id, 10) || 0,
    exercise_type_id: Number(exercise.exercise_type_id),
    created_at: guestRoutine.created_at,
    updated_at: guestRoutine.updated_at,
    exercise_type: {
      id: Number.parseInt(exercise.exercise_type.id, 10) || 0,
      name: exercise.exercise_type.name,
      description: exercise.exercise_type.description,
      default_intensity_unit: exercise.exercise_type.default_intensity_unit,
      times_used: exercise.exercise_type.times_used,
    },
    set_templates: exercise.sets.map((setTemplate) => ({
      id: Number.parseInt(setTemplate.id, 10) || 0,
      reps: setTemplate.reps,
      intensity: setTemplate.intensity,
      intensity_unit_id: setTemplate.intensity_unit_id,
      created_at: guestRoutine.created_at,
      updated_at: guestRoutine.updated_at,
      intensity_unit: {
        id: setTemplate.intensity_unit_id,
        name: "",
        abbreviation: "",
      },
    })),
  })),
});

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
    isPending: routinePending,
    error: routineError,
  } = useQuery({
    queryKey: ["routine", routineId],
    queryFn: () => getRoutine(Number(routineId)),
    enabled: isAuthenticated && !!routineId,
  });

  const {
    data: serverIntensityUnits = [],
    isPending: unitsPending,
  } = useQuery({
    queryKey: ["intensityUnits"],
    queryFn: getIntensityUnits,
    enabled: isAuthenticated,
  });

  const availableIntensityUnits: RoutineIntensityUnitOption[] = isAuthenticated
    ? serverIntensityUnits.map((unit) => ({
        id: unit.id,
        name: unit.name,
        abbreviation: unit.abbreviation,
      }))
    : guestIntensityUnits;

  const routine = useMemo(() => {
    if (isAuthenticated) {
      return serverRoutine ?? null;
    }

    if (!guestRoutine) {
      return null;
    }

    return toRoutineFromGuest(guestRoutine);
  }, [guestRoutine, isAuthenticated, serverRoutine]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editorTemplates, setEditorTemplates] = useState<RoutineEditorTemplate[]>(
    [],
  );
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");
  const [exercisePickerTarget, setExercisePickerTarget] =
    useState<ExercisePickerTarget | null>(null);
  const [unitPickerTarget, setUnitPickerTarget] = useState<UnitPickerTarget | null>(
    null,
  );

  useEffect(() => {
    if (!routine) return;

    const nextName = routine.name;
    const nextDescription = routine.description ?? "";
    const nextTemplates = buildEditorTemplatesFromRoutine(
      routine,
      availableIntensityUnits,
    );

    setName(nextName);
    setDescription(nextDescription);
    setEditorTemplates(nextTemplates);
    setInitialSnapshot(
      buildComparableSnapshot(nextName, nextDescription, nextTemplates),
    );
  }, [routineId, routine?.updated_at]);

  const comparableSnapshot = useMemo(
    () => buildComparableSnapshot(name, description, editorTemplates),
    [description, editorTemplates, name],
  );

  const hasUnsavedChanges =
    initialSnapshot.length > 0 && comparableSnapshot !== initialSnapshot;
  const hasInvalidTemplates =
    !name.trim() ||
    editorTemplates.some(
      (template) =>
        template.exercise_type_id == null ||
        template.set_templates.some((setTemplate) => !setTemplate.intensity_unit_id),
    );

  const handleExerciseTypeSelected = (
    selectedExerciseType: ExerciseType | GuestExerciseType,
  ) => {
    const nextExerciseType = toRoutineExerciseTypeOption(selectedExerciseType);
    const defaultUnitId = nextExerciseType?.default_intensity_unit;

    setEditorTemplates((currentTemplates) => {
      if (!exercisePickerTarget || !nextExerciseType) {
        return currentTemplates;
      }

      if (exercisePickerTarget.mode === "add") {
        return [
          ...currentTemplates,
          {
            id: createTempId(),
            exercise_type_id: Number(nextExerciseType.id),
            exercise_type: nextExerciseType,
            set_templates: [
              createDefaultSet(availableIntensityUnits, defaultUnitId),
            ],
          },
        ];
      }

      return currentTemplates.map((template) =>
        template.id === exercisePickerTarget.templateId
          ? {
              ...template,
              exercise_type_id: Number(nextExerciseType.id),
              exercise_type: nextExerciseType,
              set_templates:
                template.set_templates.length > 0
                  ? template.set_templates
                  : [createDefaultSet(availableIntensityUnits, defaultUnitId)],
            }
          : template,
      );
    });

    setExercisePickerTarget(null);
  };

  const handleIntensityUnitSelected = (
    selectedUnit: IntensityUnit | GuestIntensityUnit,
  ) => {
    if (!unitPickerTarget) return;

    const nextUnit = toRoutineIntensityUnitOption(selectedUnit);
    if (!nextUnit) return;

    setEditorTemplates((currentTemplates) =>
      currentTemplates.map((template) =>
        template.id !== unitPickerTarget.templateId
          ? template
          : {
              ...template,
              set_templates: template.set_templates.map((setTemplate) =>
                setTemplate.id !== unitPickerTarget.setId
                  ? setTemplate
                  : {
                      ...setTemplate,
                      intensity_unit_id: nextUnit.id,
                      intensity_unit: nextUnit,
                    },
              ),
            },
      ),
    );

    setUnitPickerTarget(null);
  };

  const updateSet = (
    templateId: string,
    setId: string,
    updates: Partial<RoutineEditorSet>,
  ) => {
    setEditorTemplates((currentTemplates) =>
      currentTemplates.map((template) =>
        template.id !== templateId
          ? template
          : {
              ...template,
              set_templates: template.set_templates.map((setTemplate) =>
                setTemplate.id === setId
                  ? {
                      ...setTemplate,
                      ...updates,
                    }
                  : setTemplate,
              ),
            },
      ),
    );
  };

  const addSetToTemplate = (templateId: string) => {
    setEditorTemplates((currentTemplates) =>
      currentTemplates.map((template) =>
        template.id !== templateId
          ? template
          : {
              ...template,
              set_templates: [
                ...template.set_templates,
                createDefaultSet(
                  availableIntensityUnits,
                  template.exercise_type?.default_intensity_unit,
                ),
              ],
            },
      ),
    );
  };

  const removeSetFromTemplate = (templateId: string, setId: string) => {
    setEditorTemplates((currentTemplates) =>
      currentTemplates.map((template) =>
        template.id !== templateId
          ? template
          : {
              ...template,
              set_templates: template.set_templates.filter(
                (setTemplate) => setTemplate.id !== setId,
              ),
            },
      ),
    );
  };

  const removeTemplate = (templateId: string) => {
    setEditorTemplates((currentTemplates) =>
      currentTemplates.filter((template) => template.id !== templateId),
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!routine) {
        throw new Error("Routine not found");
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        workout_type_id: routine.workout_type_id,
        exercise_templates: buildRoutinePayload(editorTemplates),
      };

      if (isAuthenticated) {
        return updateRoutine(routine.id, payload);
      }

      updateGuestRoutine(guestRoutine?.id ?? String(routine.id), {
        name: payload.name,
        description: payload.description ?? undefined,
        exercises: toGuestRoutineExercises(editorTemplates),
      });
      return null;
    },
    onSuccess: async (updatedRoutine) => {
      if (!routineId) return;

      if (updatedRoutine) {
        queryClient.setQueryData(["routine", routineId], updatedRoutine);
      }

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

      deleteGuestRoutine(guestRoutine?.id ?? String(routine.id));
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
      const workoutName = `${name.trim() || routine.name} - ${new Date().toLocaleDateString(
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

      const guestRoutineForStart = {
        id: guestRoutine?.id ?? String(routine.id),
        name: name.trim() || routine.name,
        description: description.trim() || undefined,
        exercises: toGuestRoutineExercises(editorTemplates),
        created_at: guestRoutine?.created_at ?? routine.created_at,
        updated_at: guestRoutine?.updated_at ?? routine.updated_at,
      } satisfies GuestRoutine;

      createExercisesFromRoutine(guestRoutineForStart, newWorkoutId);
      return { id: newWorkoutId };
    },
    onSuccess: (result) => {
      if (!result) return;
      navigate(`/workouts/${result.id}`);
    },
  });

  const handleDelete = () => {
    if (!routine) return;

    const confirmed = window.confirm(
      `Delete routine "${routine.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    deleteMutation.mutate();
  };

  if (isAuthenticated && (routinePending || unitsPending)) {
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

  if ((isAuthenticated && routineError) || !routine) {
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
      <div className="bg-card text-card-foreground mx-auto mt-2 max-w-4xl rounded-lg p-2 shadow-lg md:mt-4 md:p-4 lg:mt-8 lg:p-6">
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
              Routine Editor
            </h1>
            <p className="text-muted-foreground text-sm">
              Edit the template directly. Changes save the full
              `exercise_templates` and `set_templates` tree in one request.
            </p>
          </div>
        </div>

        <div className="grid gap-4 text-left">
          {(saveMutation.error || startMutation.error || deleteMutation.error) && (
            <Alert variant="destructive">
              <AlertTitle>Action failed</AlertTitle>
              <AlertDescription>
                {saveMutation.error instanceof Error
                  ? saveMutation.error.message
                  : startMutation.error instanceof Error
                    ? startMutation.error.message
                    : deleteMutation.error instanceof Error
                      ? deleteMutation.error.message
                      : "Something went wrong while updating the routine."}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Routine Info</CardTitle>
              <CardDescription>
                Update the routine metadata and save the full template when
                you&apos;re ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="routine-name" className="text-sm font-medium">
                  Routine Name
                </label>
                <Input
                  id="routine-name"
                  data-testid="routine-name-input"
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
                  data-testid="routine-description-input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional routine description"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  data-testid="save-routine-button"
                  onClick={() => saveMutation.mutate()}
                  disabled={
                    hasInvalidTemplates ||
                    !hasUnsavedChanges ||
                    saveMutation.isPending
                  }
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? "Saving..." : "Save Routine"}
                </Button>
                <Button
                  data-testid="start-routine-workout-button"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  variant="outline"
                  className="flex-1"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {startMutation.isPending ? "Starting..." : "Start Workout"}
                </Button>
                <Button
                  data-testid="delete-routine-button"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleteMutation.isPending ? "Deleting..." : "Delete Routine"}
                </Button>
              </div>

              {hasInvalidTemplates && (
                <p className="text-sm text-muted-foreground">
                  Every exercise template needs a selected exercise type and
                  every set needs an intensity unit before you can save.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Exercise Templates</CardTitle>
                  <CardDescription>
                    Build the routine the way `WorkoutPage` builds a live
                    workout, but without timer or completion state.
                  </CardDescription>
                </div>
                <Button
                  data-testid="add-routine-exercise-button"
                  onClick={() => setExercisePickerTarget({ mode: "add" })}
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Exercise
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editorTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No exercise templates yet. Add one to start building the
                  routine.
                </div>
              ) : (
                editorTemplates.map((template, templateIndex) => (
                  <div
                    key={template.id}
                    data-testid={`routine-template-${templateIndex}`}
                    className="rounded-lg border bg-muted/30 p-4"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-semibold">
                          {templateIndex + 1}.{" "}
                          {template.exercise_type?.name ?? "Select exercise"}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {template.set_templates.length} set
                          {template.set_templates.length !== 1 ? "s" : ""} in
                          this template
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          data-testid={`change-routine-exercise-${templateIndex}`}
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setExercisePickerTarget({
                              mode: "replace",
                              templateId: template.id,
                            })
                          }
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Change Exercise
                        </Button>
                        <Button
                          data-testid={`remove-routine-template-${templateIndex}`}
                          variant="destructive"
                          size="sm"
                          onClick={() => removeTemplate(template.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {template.set_templates.map((setTemplate, setIndex) => (
                        <div
                          key={setTemplate.id}
                          data-testid={`routine-template-${templateIndex}-set-${setIndex}`}
                          className="rounded-md border bg-background p-3"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium">Set {setIndex + 1}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatSetSummary(setTemplate)}
                              </div>
                            </div>
                            <Button
                              data-testid={`remove-routine-set-${templateIndex}-${setIndex}`}
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                removeSetFromTemplate(template.id, setTemplate.id)
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove Set
                            </Button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="grid gap-2">
                              <label
                                htmlFor={`${template.id}-${setTemplate.id}-reps`}
                                className="text-sm font-medium"
                              >
                                Reps
                              </label>
                              <Input
                                id={`${template.id}-${setTemplate.id}-reps`}
                                data-testid={`routine-set-reps-${templateIndex}-${setIndex}`}
                                type="number"
                                min="0"
                                step="1"
                                value={setTemplate.reps ?? ""}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  updateSet(template.id, setTemplate.id, {
                                    reps:
                                      nextValue.trim() === ""
                                        ? null
                                        : Number.parseInt(nextValue, 10),
                                  });
                                }}
                                placeholder="e.g. 10"
                              />
                            </div>

                            <div className="grid gap-2">
                              <label
                                htmlFor={`${template.id}-${setTemplate.id}-intensity`}
                                className="text-sm font-medium"
                              >
                                Intensity
                              </label>
                              <Input
                                id={`${template.id}-${setTemplate.id}-intensity`}
                                data-testid={`routine-set-intensity-${templateIndex}-${setIndex}`}
                                inputMode="decimal"
                                value={setTemplate.intensity ?? ""}
                                onChange={(event) =>
                                  updateSet(template.id, setTemplate.id, {
                                    intensity: parseDecimalInput(event.target.value),
                                  })
                                }
                                placeholder="e.g. 135"
                              />
                            </div>

                            <div className="grid gap-2">
                              <span className="text-sm font-medium">
                                Intensity Unit
                              </span>
                              <Button
                                data-testid={`routine-set-unit-${templateIndex}-${setIndex}`}
                                variant="outline"
                                className="justify-start"
                                onClick={() =>
                                  setUnitPickerTarget({
                                    templateId: template.id,
                                    setId: setTemplate.id,
                                  })
                                }
                              >
                                {setTemplate.intensity_unit
                                  ? `${setTemplate.intensity_unit.abbreviation} - ${setTemplate.intensity_unit.name}`
                                  : "Select unit"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      data-testid={`add-routine-set-${templateIndex}`}
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => addSetToTemplate(template.id)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Set
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ExerciseTypeModal
        isOpen={exercisePickerTarget !== null}
        onClose={() => setExercisePickerTarget(null)}
        onSelect={handleExerciseTypeSelected}
      />

      <IntensityUnitModal
        isOpen={unitPickerTarget !== null}
        onClose={() => setUnitPickerTarget(null)}
        onSelect={handleIntensityUnitSelected}
      />
    </div>
  );
};

export default RoutineDetailsPage;
