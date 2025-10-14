// Muscle group mapping utility
// Uses real muscle group data from the backend API

import type { MuscleGroup, Muscle } from "@/shared/types";

export interface MuscleGroupSummary {
  name: string;
  setCount: number;
}

export interface ExerciseTypeWithMuscles {
  id: number | string;
  name: string;
  description: string;
  default_intensity_unit: number;
  times_used: number;
  muscles: Muscle[];
}

// Mapping from individual muscle names to anatomical muscle groups
// This handles the imported muscle data that uses generic "Imported" muscle group
const MUSCLE_NAME_TO_GROUP: Record<string, string> = {
  // Arms
  biceps: "Arms",
  triceps: "Arms",

  // Forearms
  forearms: "Forearms",

  // Chest
  chest: "Chest",
  "pectoralis major": "Chest",
  "pectoralis minor": "Chest",

  // Back
  lats: "Back",
  "latissimus dorsi": "Back",
  traps: "Back",
  trapezius: "Back",
  rhomboids: "Back",
  "lower back": "Back",
  "middle back": "Back",

  // Shoulders
  shoulders: "Shoulders",

  // Core
  abdominals: "Core",

  // Legs (quadriceps, hamstrings, calves, adductors, abductors)
  quadriceps: "Legs",
  hamstrings: "Legs",
  calves: "Legs",
  adductors: "Legs",
  abductors: "Legs",

  // Glutes
  glutes: "Glutes",

  // Neck
  neck: "Neck",
};

/**
 * Gets muscle groups for an exercise type using the real muscle data from the API
 */
export function getExerciseMuscleGroups(
  exerciseType: ExerciseTypeWithMuscles,
): string[] {
  if (!exerciseType.muscles || exerciseType.muscles.length === 0) {
    return ["General"];
  }

  const muscleGroupNames = new Set<string>();

  exerciseType.muscles.forEach((muscle) => {
    // First try to use the muscle group name directly (for properly categorized muscles)
    if (muscle.muscle_group.name !== "Imported") {
      muscleGroupNames.add(muscle.muscle_group.name);
    } else {
      // For imported muscles, map individual muscle names to anatomical groups
      const muscleName = muscle.name.toLowerCase();
      const anatomicalGroup = MUSCLE_NAME_TO_GROUP[muscleName];

      if (anatomicalGroup) {
        muscleGroupNames.add(anatomicalGroup);
      } else {
        // Fallback: try to infer from muscle name
        console.warn(
          `Unknown muscle name for anatomical mapping: ${muscle.name}`,
        );
        muscleGroupNames.add("General");
      }
    }
  });

  return Array.from(muscleGroupNames);
}

/**
 * Fallback function for guest mode or when muscle data is not available
 */
export function getExerciseMuscleGroupsFallback(
  exerciseTypeName: string,
): string[] {
  // Exact matches for common exercises
  const exactMatches: Record<string, string[]> = {
    // Chest exercises
    "Bench Press": ["Chest"],
    "Incline Bench Press": ["Chest", "Shoulders"],
    "Decline Bench Press": ["Chest"],
    "Dumbbell Press": ["Chest", "Shoulders"],
    "Chest Press": ["Chest"],
    "Chest Fly": ["Chest"],
    "Dumbbell Fly": ["Chest"],
    "Push-ups": ["Chest", "Arms"],
    "Incline Push-ups": ["Chest", "Arms"],
    Dips: ["Chest", "Arms"],

    // Back exercises
    Deadlift: ["Back", "Legs"],
    "Pull-ups": ["Back", "Arms"],
    "Chin-ups": ["Back", "Arms"],
    "Bent Over Row": ["Back"],
    "Barbell Row": ["Back"],
    "Dumbbell Row": ["Back"],
    "T-Bar Row": ["Back"],
    "Seated Row": ["Back"],
    "Lat Pulldown": ["Back"],
    Shrugs: ["Back", "Shoulders"],

    // Leg exercises
    Squats: ["Legs"],
    "Back Squat": ["Legs"],
    "Front Squat": ["Legs"],
    "Goblet Squat": ["Legs"],
    "Leg Press": ["Legs"],
    Lunges: ["Legs"],
    "Bulgarian Split Squat": ["Legs"],
    "Leg Extension": ["Legs"],
    "Leg Curl": ["Legs"],
    "Romanian Deadlift": ["Legs", "Back"],
    "Calf Raise": ["Legs"],
    "Standing Calf Raise": ["Legs"],
    "Seated Calf Raise": ["Legs"],

    // Shoulder exercises
    "Overhead Press": ["Shoulders"],
    "Military Press": ["Shoulders"],
    "Shoulder Press": ["Shoulders"],
    "Lateral Raise": ["Shoulders"],
    "Side Raise": ["Shoulders"],
    "Front Raise": ["Shoulders"],
    "Rear Delt Fly": ["Shoulders"],
    "Face Pull": ["Shoulders", "Back"],
    "Arnold Press": ["Shoulders"],

    // Arm exercises
    "Bicep Curl": ["Arms"],
    "Barbell Curl": ["Arms"],
    "Dumbbell Curl": ["Arms"],
    "Hammer Curl": ["Arms"],
    "Tricep Extension": ["Arms"],
    "Overhead Tricep Extension": ["Arms"],
    "Tricep Pushdown": ["Arms"],
    "Close Grip Bench Press": ["Arms", "Chest"],
    "Diamond Push-ups": ["Arms", "Chest"],
    "Preacher Curl": ["Arms"],
    "Cable Curl": ["Arms"],
    "Skull Crushers": ["Arms"],

    // Core exercises
    Plank: ["Core"],
    "Side Plank": ["Core"],
    Crunches: ["Core"],
    "Sit-ups": ["Core"],
    "Russian Twists": ["Core"],
    "Mountain Climbers": ["Core"],
    "Dead Bug": ["Core"],
    "Bicycle Crunches": ["Core"],
    "Leg Raises": ["Core"],
    "Hanging Leg Raises": ["Core"],

    // Compound movements
    "Clean and Press": ["Shoulders", "Back", "Legs"],
    Thrusters: ["Shoulders", "Legs"],
    Burpees: ["Chest", "Arms", "Legs", "Core"],
    "Turkish Get-up": ["Core", "Shoulders"],
    "Farmer's Walk": ["Back", "Arms", "Legs"],
    "Bear Crawl": ["Core", "Arms", "Shoulders"],
  };

  // First try exact match
  const exactMatch = exactMatches[exerciseTypeName];
  if (exactMatch) {
    return exactMatch;
  }

  const lowerExerciseName = exerciseTypeName.toLowerCase();
  const matchedMuscleGroups = new Set<string>();

  // Arms
  if (
    lowerExerciseName.includes("bicep") ||
    lowerExerciseName.includes("curl") ||
    lowerExerciseName.includes("tricep") ||
    lowerExerciseName.includes("pushdown")
  ) {
    matchedMuscleGroups.add("Arms");
  }

  // Chest
  if (
    lowerExerciseName.includes("bench press") ||
    lowerExerciseName.includes("chest press") ||
    lowerExerciseName.includes("fly") ||
    lowerExerciseName.includes("push-up")
  ) {
    matchedMuscleGroups.add("Chest");
    if (lowerExerciseName.includes("push-up")) {
      matchedMuscleGroups.add("Arms");
    }
  }

  // Back
  if (
    lowerExerciseName.includes("row") ||
    lowerExerciseName.includes("pulldown") ||
    lowerExerciseName.includes("pull-up")
  ) {
    matchedMuscleGroups.add("Back");
    if (lowerExerciseName.includes("pull-up")) {
      matchedMuscleGroups.add("Arms");
    }
  }

  // Shoulders
  if (
    lowerExerciseName.includes("shoulder press") ||
    lowerExerciseName.includes("overhead press") ||
    (lowerExerciseName.includes("raise") && !lowerExerciseName.includes("calf"))
  ) {
    matchedMuscleGroups.add("Shoulders");
  }

  // Legs
  if (
    lowerExerciseName.includes("squat") ||
    lowerExerciseName.includes("lunge") ||
    lowerExerciseName.includes("leg press") ||
    lowerExerciseName.includes("leg extension") ||
    lowerExerciseName.includes("leg curl") ||
    lowerExerciseName.includes("deadlift") ||
    lowerExerciseName.includes("calf raise")
  ) {
    matchedMuscleGroups.add("Legs");
    if (lowerExerciseName.includes("deadlift")) {
      matchedMuscleGroups.add("Back");
    }
  }

  // Core
  if (
    lowerExerciseName.includes("plank") ||
    lowerExerciseName.includes("crunch")
  ) {
    matchedMuscleGroups.add("Core");
  }

  // Generic keywords if nothing else matched
  if (matchedMuscleGroups.size === 0) {
    if (lowerExerciseName.includes("press")) {
      matchedMuscleGroups.add("Chest");
      matchedMuscleGroups.add("Shoulders");
    }
    if (lowerExerciseName.includes("extension")) {
      // Ambiguous, but better than nothing. Could be refined if more context is available.
      matchedMuscleGroups.add("Arms");
      matchedMuscleGroups.add("Legs");
    }
  }

  return matchedMuscleGroups.size > 0
    ? Array.from(matchedMuscleGroups)
    : ["General"];
}

/**
 * Helper function to get muscle groups for an exercise, using API data if available,
 * otherwise falling back to keyword-based matching.
 */
export function getMuscleGroupsForExercise(
  exerciseType: ExerciseTypeWithMuscles | { name: string },
): string[] {
  if ("muscles" in exerciseType) {
    return getExerciseMuscleGroups(exerciseType as ExerciseTypeWithMuscles);
  }
  return getExerciseMuscleGroupsFallback(exerciseType.name);
}

/**
 * Calculates muscle group summary from exercises
 */
export function calculateMuscleGroupSummary(
  exercises: Array<{
    exercise_type: ExerciseTypeWithMuscles | { name: string };
    exercise_sets: Array<{ done?: boolean }>;
  }>,
): MuscleGroupSummary[] {
  const muscleGroupCounts = new Map<string, number>();

  exercises.forEach((exercise) => {
    // Only count completed sets
    const completedSets = exercise.exercise_sets.filter(
      (set) => set.done,
    ).length;

    if (completedSets > 0) {
      const muscleGroups = getMuscleGroupsForExercise(exercise.exercise_type);

      muscleGroups.forEach((muscleGroup) => {
        const currentCount = muscleGroupCounts.get(muscleGroup) || 0;
        muscleGroupCounts.set(muscleGroup, currentCount + completedSets);
      });
    }
  });

  // Convert to array and sort by set count (descending)
  return Array.from(muscleGroupCounts.entries())
    .map(([name, setCount]) => ({ name, setCount }))
    .sort((a, b) => b.setCount - a.setCount);
}
