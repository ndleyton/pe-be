import type { IntensityUnit } from "@/features/exercises/api";

export const GUEST_INTENSITY_UNIT_IDS = {
  kilograms: 1,
  pounds: 2,
  kilometersPerHour: 3,
  milesPerHour: 4,
  bodyweight: 5,
} as const;

export const KNOWN_INTENSITY_UNITS = [
  {
    id: GUEST_INTENSITY_UNIT_IDS.kilograms,
    name: "Kilograms",
    abbreviation: "kg",
  },
  {
    id: GUEST_INTENSITY_UNIT_IDS.pounds,
    name: "Pounds",
    abbreviation: "lbs",
  },
  {
    id: GUEST_INTENSITY_UNIT_IDS.kilometersPerHour,
    name: "Kilometers per hour",
    abbreviation: "km/h",
  },
  {
    id: GUEST_INTENSITY_UNIT_IDS.milesPerHour,
    name: "Miles per hour",
    abbreviation: "mph",
  },
  {
    id: GUEST_INTENSITY_UNIT_IDS.bodyweight,
    name: "Bodyweight",
    abbreviation: "BW",
  },
] satisfies IntensityUnit[];

export const GUEST_INTENSITY_UNITS = KNOWN_INTENSITY_UNITS;

export const EXERCISE_TYPE_MODAL_INITIAL_LIMIT = 100;
