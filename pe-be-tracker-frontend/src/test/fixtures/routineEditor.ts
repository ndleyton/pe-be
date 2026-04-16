import type { RoutineEditorSet } from "@/features/routines/lib/routineEditor";

export const speedSet: RoutineEditorSet = {
  id: "set-1",
  reps: null,
  duration_seconds: 605,
  intensity: 10,
  rpe: null,
  rir: null,
  notes: "",
  type: null,
  intensity_unit_id: 3,
  intensity_unit: {
    id: 3,
    name: "Kilometers per hour",
    abbreviation: "km/h",
  },
};

export const repSet: RoutineEditorSet = {
  id: "set-1",
  reps: 8,
  duration_seconds: null,
  intensity: 50,
  rpe: null,
  rir: null,
  notes: "",
  type: null,
  intensity_unit_id: 1,
  intensity_unit: {
    id: 1,
    name: "Kilograms",
    abbreviation: "kg",
  },
};
