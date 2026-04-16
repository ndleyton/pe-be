import type {
  ExerciseType,
  IntensityUnit,
} from "@/features/exercises/api";
import { GUEST_INTENSITY_UNITS } from "@/features/exercises/constants";
import {
  DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS,
  prefersDurationForIntensityUnit,
} from "@/features/exercises/lib/intensityUnits";
import type { Routine, RoutineVisibility } from "@/features/routines/types";
import type {
  GuestExerciseType,
  GuestIntensityUnit,
} from "@/stores";
import { formatSetSummary as formatExerciseSetSummary } from "@/features/exercises/lib/setSummary";

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
  duration_seconds: number | null;
  intensity: number | null;
  rpe: number | null;
  intensity_unit_id: number;
  intensity_unit: RoutineIntensityUnitOption | null;
};

export type RoutineEditorTemplate = {
  id: string;
  exercise_type_id: number | null;
  exercise_type: RoutineExerciseTypeOption | null;
  set_templates: RoutineEditorSet[];
  notes: string;
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
  return formatExerciseSetSummary({
    reps: setTemplate.reps,
    duration_seconds: setTemplate.duration_seconds,
    intensity: setTemplate.intensity,
    rpe: setTemplate.rpe,
    intensityUnitAbbreviation: setTemplate.intensity_unit?.abbreviation,
  });
};

export const buildEditorTemplatesFromRoutine = (
  routine: Routine,
  availableUnits: RoutineIntensityUnitOption[],
): RoutineEditorTemplate[] =>
  routine.exercise_templates.map((template) => ({
    id: String(template.id),
    exercise_type_id: template.exercise_type_id,
    exercise_type: toRoutineExerciseTypeOption(template.exercise_type),
    notes: template.notes ?? "",
    set_templates: template.set_templates.map((setTemplate) => ({
      id: String(setTemplate.id),
      reps: setTemplate.reps ?? null,
      duration_seconds: setTemplate.duration_seconds ?? null,
      intensity: setTemplate.intensity ?? null,
      rpe: setTemplate.rpe ?? null,
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
    notes: template.notes.trim() || null,
    set_templates: template.set_templates.map((setTemplate) => ({
      reps: setTemplate.reps,
      intensity: setTemplate.intensity,
      intensity_unit_id: setTemplate.intensity_unit_id,
      ...(setTemplate.rpe != null ? { rpe: setTemplate.rpe } : {}),
      ...(setTemplate.duration_seconds != null
        ? { duration_seconds: setTemplate.duration_seconds }
        : {}),
    })),
  }));

export const buildComparableSnapshot = (
  name: string,
  description: string,
  visibility: RoutineVisibility,
  author: string | null,
  category: string | null,
  templates: RoutineEditorTemplate[],
) =>
  JSON.stringify({
    name: name.trim(),
    description: description.trim() || null,
    visibility,
    author: author != null ? author.trim() : null,
    category: category != null ? category.trim() : null,
    exercise_templates: templates.map((template) => ({
      exercise_type_id: template.exercise_type_id,
      notes: template.notes.trim() || null,
      set_templates: template.set_templates.map((setTemplate) => ({
        reps: setTemplate.reps,
        duration_seconds: setTemplate.duration_seconds,
        intensity: setTemplate.intensity,
        rpe: setTemplate.rpe,
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
    duration_seconds: prefersDurationForIntensityUnit(fallbackUnit)
      ? DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS
      : null,
    intensity: null,
    rpe: null,
    intensity_unit_id: fallbackUnit.id,
    intensity_unit: fallbackUnit,
  };
};

export const buildRoutineFromEditorState = ({
  description,
  name,
  visibility,
  author,
  category,
  routine,
  templates,
}: {
  description: string;
  name: string;
  visibility: RoutineVisibility;
  author: string | null;
  category: string | null;
  routine: Routine;
  templates: RoutineEditorTemplate[];
}): Routine => ({
  ...routine,
  name: name.trim() || routine.name,
  description: description.trim() || null,
  visibility,
  author: author != null ? author.trim() : null,
  category: category != null ? category.trim() : null,
  exercise_templates: templates.map((template, templateIndex) => ({
    id: Number(template.id) || -(templateIndex + 1),
    exercise_type_id: Number(template.exercise_type_id),
    notes: template.notes.trim() || null,
    created_at: routine.created_at,
    updated_at: routine.updated_at,
    exercise_type: template.exercise_type
      ? {
          id: Number(template.exercise_type.id),
          name: template.exercise_type.name,
          description: template.exercise_type.description,
          default_intensity_unit: template.exercise_type.default_intensity_unit,
          times_used: template.exercise_type.times_used,
        }
      : undefined,
    set_templates: template.set_templates.map((setTemplate, setIndex) => ({
      id: Number(setTemplate.id) || -(templateIndex * 100 + setIndex + 1),
      reps: setTemplate.reps,
      duration_seconds: setTemplate.duration_seconds,
      intensity: setTemplate.intensity,
      rpe: setTemplate.rpe,
      intensity_unit_id: setTemplate.intensity_unit_id,
      created_at: routine.created_at,
      updated_at: routine.updated_at,
      intensity_unit: setTemplate.intensity_unit
        ? {
            id: setTemplate.intensity_unit.id,
            name: setTemplate.intensity_unit.name,
            abbreviation: setTemplate.intensity_unit.abbreviation,
          }
        : undefined,
    })),
  })),
});
