import type { Muscle, MuscleGroup } from "@/shared/types";
import type { ExerciseTypeWithMuscles } from "@/utils/muscleGroups";

const DEFAULT_TIMESTAMP = "2025-01-01T00:00:00Z";

let muscleGroupFixtureId = 1;
let muscleFixtureId = 1;
let summaryExerciseFixtureId = 1;

export const makeMuscleGroup = (
  overrides: Partial<MuscleGroup> = {},
): MuscleGroup => ({
  id: muscleGroupFixtureId++,
  name: "Chest",
  created_at: DEFAULT_TIMESTAMP,
  updated_at: DEFAULT_TIMESTAMP,
  ...overrides,
});

export const makeMuscle = (
  overrides: Partial<Muscle> = {},
): Muscle => {
  const muscleGroup = overrides.muscle_group ?? makeMuscleGroup();
  const muscle = {
    id: muscleFixtureId++,
    name: "Pectoralis Major",
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
    ...overrides,
  };

  return {
    ...muscle,
    muscle_group: muscleGroup,
    muscle_group_id: overrides.muscle_group_id ?? muscleGroup.id,
  };
};

type SummaryExercise = {
  exercise_type: ExerciseTypeWithMuscles | { name: string };
  exercise_sets: Array<{ done?: boolean }>;
};

type SummaryExerciseOptions = {
  completedSets?: number;
  exerciseSets?: Array<{ done?: boolean }>;
  muscleGroups?: Array<string | MuscleGroup>;
  muscles?: Muscle[];
  name?: string;
  overrides?: Partial<SummaryExercise>;
  pendingSets?: number;
};

const DEFAULT_MUSCLE_NAMES: Record<string, string> = {
  Arms: "Triceps",
  Back: "Latissimus Dorsi",
  Chest: "Pectoralis Major",
  Core: "Abdominals",
  Forearms: "Forearms",
  Glutes: "Glutes",
  Legs: "Quadriceps",
  Neck: "Neck",
  Shoulders: "Shoulders",
};

export const makeExerciseForSummary = ({
  completedSets = 0,
  exerciseSets,
  muscleGroups = [],
  muscles,
  name = `Exercise ${summaryExerciseFixtureId++}`,
  overrides = {},
  pendingSets = 0,
}: SummaryExerciseOptions = {}): SummaryExercise => {
  const summaryMuscles =
    muscles ??
    muscleGroups.map((group, index) => {
      const muscleGroup =
        typeof group === "string"
          ? makeMuscleGroup({ name: group })
          : group;

      return makeMuscle({
        id: index + 1,
        name: DEFAULT_MUSCLE_NAMES[muscleGroup.name] ?? `${muscleGroup.name} Muscle`,
        muscle_group: muscleGroup,
      });
    });

  const resolvedSets =
    exerciseSets ??
    [
      ...Array.from({ length: completedSets }, () => ({ done: true })),
      ...Array.from({ length: pendingSets }, () => ({ done: false })),
    ];

  const exerciseType: ExerciseTypeWithMuscles = {
    id: name,
    name,
    description: `${name} description`,
    default_intensity_unit: 1,
    times_used: 0,
    muscles: summaryMuscles,
  };

  return {
    exercise_type: exerciseType,
    exercise_sets: resolvedSets,
    ...overrides,
  };
};
