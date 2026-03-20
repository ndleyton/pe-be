import type { IntensityUnit } from "@/features/exercises/api";

export const GUEST_INTENSITY_UNIT_IDS = {
  kilograms: 1,
  pounds: 2,
  bodyweight: 5,
} as const;

export const GUEST_INTENSITY_UNITS = [
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
    id: GUEST_INTENSITY_UNIT_IDS.bodyweight,
    name: "Bodyweight",
    abbreviation: "BW",
  },
] satisfies IntensityUnit[];
