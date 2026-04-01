import type { Exercise, IntensityUnit } from "@/features/exercises/api";

export interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

type IntensityUnitLike = IntensityUnit | GuestIntensityUnit;
type IntensityUnitFamily = "mass" | "speed" | "bodyweight";

type IntensityUnitDefinition = {
  family: IntensityUnitFamily;
  toBaseFactor: number;
};

const KNOWN_INTENSITY_UNIT_DEFINITIONS: Record<number, IntensityUnitDefinition> = {
  1: { family: "mass", toBaseFactor: 1 },
  2: { family: "mass", toBaseFactor: 0.45359237 },
  3: { family: "speed", toBaseFactor: 1 },
  4: { family: "speed", toBaseFactor: 1.609344 },
  5: { family: "bodyweight", toBaseFactor: 1 },
};

const roundToThreeDecimals = (value: number): number =>
  Math.round(value * 1000) / 1000;

export const getIntensityUnitDefinition = (
  unitId: number | null | undefined,
): IntensityUnitDefinition | null =>
  unitId ? KNOWN_INTENSITY_UNIT_DEFINITIONS[unitId] ?? null : null;

export const getIntensityUnitFamily = (
  unit: IntensityUnitLike | null | undefined,
): IntensityUnitFamily | null =>
  getIntensityUnitDefinition(unit?.id)?.family ?? null;

export const areIntensityUnitsCompatible = (
  sourceUnitId: number | null | undefined,
  targetUnitId: number | null | undefined,
): boolean => {
  const sourceDefinition = getIntensityUnitDefinition(sourceUnitId);
  const targetDefinition = getIntensityUnitDefinition(targetUnitId);

  if (!sourceDefinition || !targetDefinition) {
    return false;
  }

  return sourceDefinition.family === targetDefinition.family;
};

export const convertIntensityValue = (
  value: number | null | undefined,
  sourceUnitId: number | null | undefined,
  targetUnitId: number | null | undefined,
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (!sourceUnitId || !targetUnitId || sourceUnitId === targetUnitId) {
    return value;
  }

  const sourceDefinition = getIntensityUnitDefinition(sourceUnitId);
  const targetDefinition = getIntensityUnitDefinition(targetUnitId);

  if (
    !sourceDefinition ||
    !targetDefinition ||
    sourceDefinition.family !== targetDefinition.family
  ) {
    return value;
  }

  const baseValue = value * sourceDefinition.toBaseFactor;
  return roundToThreeDecimals(baseValue / targetDefinition.toBaseFactor);
};

export const getCompatibleIntensityUnits = <T extends IntensityUnitLike>(
  units: T[],
  currentUnit: IntensityUnitLike | null | undefined,
): T[] => {
  const currentFamily = getIntensityUnitFamily(currentUnit);
  if (!currentFamily) {
    return units;
  }

  return units.filter((unit) => getIntensityUnitFamily(unit) === currentFamily);
};

interface IntensityUnitProvider {
  intensity_unit_id: number;
}

export const resolveDisplayIntensityUnit = (
  items: IntensityUnitProvider[],
  defaultUnitId: number | null | undefined,
  availableUnits: IntensityUnitLike[],
  fallbackUnit: IntensityUnitLike,
): IntensityUnitLike => {
  const firstUnitId = items[0]?.intensity_unit_id;
  const preferredUnitId = firstUnitId ?? defaultUnitId;

  return (
    availableUnits.find((unit) => unit.id === preferredUnitId) ??
    availableUnits.find((unit) => unit.id === firstUnitId) ??
    fallbackUnit
  );
};

export const resolveExerciseDisplayIntensityUnit = (
  exercise: Exercise,
  availableUnits: IntensityUnitLike[],
  fallbackUnit: IntensityUnitLike,
): IntensityUnitLike =>
  resolveDisplayIntensityUnit(
    exercise.exercise_sets,
    exercise.exercise_type.default_intensity_unit,
    availableUnits,
    fallbackUnit,
  );
