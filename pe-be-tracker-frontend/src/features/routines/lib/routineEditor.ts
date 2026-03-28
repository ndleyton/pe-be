import type {
  ExerciseType,
  IntensityUnit,
} from "@/features/exercises/api";
import { GUEST_INTENSITY_UNITS } from "@/features/exercises/constants";
import type { Routine } from "@/features/routines/types";
import type {
  GuestExerciseType,
  GuestIntensityUnit,
  GuestRoutine,
  GuestRoutineExercise,
  GuestRoutineSet,
} from "@/stores";

export const DATE_LABEL_LOCALE = "en-US";
export const DATE_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

export const guestIntensityUnits: GuestIntensityUnit[] = [...GUEST_INTENSITY_UNITS];

export type RoutineExerciseTypeOption = {
  id: string | number;
  name: string;
  description: string | null;
  default_intensity_unit: number;
  times_used: number;
};

export type RoutineIntensityUnitOption = Pick<
  GuestIntensityUnit,
  "id" | "name" | "abbreviation"
>;

export type RoutineEditorSet = {
  id: string;
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  intensity_unit: RoutineIntensityUnitOption | null;
};

export type RoutineEditorTemplate = {
  id: string;
  exercise_type_id: number | null;
  exercise_type: RoutineExerciseTypeOption | null;
  set_templates: RoutineEditorSet[];
};

export type ExercisePickerTarget =
  | { mode: "add" }
  | { mode: "replace"; templateId: string };

export type UnitPickerTarget = {
  templateId: string;
  setId: string;
};

const createTempId = () =>
  `temp-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

export const toRoutineExerciseTypeOption = (
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

export const toRoutineIntensityUnitOption = (
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

export const findIntensityUnitById = (
  units: RoutineIntensityUnitOption[],
  id: number,
) => units.find((unit) => unit.id === id) ?? null;

export const formatSetSummary = (setTemplate: RoutineEditorSet) => {
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

export const buildEditorTemplatesFromRoutine = (
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

export const buildRoutinePayload = (
  templates: RoutineEditorTemplate[],
) =>
  templates.map((template) => ({
    exercise_type_id: Number(template.exercise_type_id),
    set_templates: template.set_templates.map((setTemplate) => ({
      reps: setTemplate.reps,
      intensity: setTemplate.intensity,
      intensity_unit_id: setTemplate.intensity_unit_id,
    })),
  }));

export const toGuestRoutineExercises = (
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

export const buildComparableSnapshot = (
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

export const createDefaultSet = (
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

export const toRoutineFromGuest = (guestRoutine: GuestRoutine): Routine => ({
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
