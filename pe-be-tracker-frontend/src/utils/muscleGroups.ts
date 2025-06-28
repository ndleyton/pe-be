// Muscle group mapping utility
// Uses real muscle group data from the backend API

export interface MuscleGroupSummary {
  name: string;
  setCount: number;
}

export interface MuscleGroup {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Muscle {
  id: number;
  name: string;
  muscle_group_id: number;
  muscle_group: MuscleGroup;
  created_at: string;
  updated_at: string;
}

export interface ExerciseTypeWithMuscles {
  id: number | string;
  name: string;
  description: string;
  default_intensity_unit: number;
  times_used: number;
  muscles: Muscle[];
}

/**
 * Gets muscle groups for an exercise type using the real muscle data from the API
 */
export function getExerciseMuscleGroups(exerciseType: ExerciseTypeWithMuscles): string[] {
  if (!exerciseType.muscles || exerciseType.muscles.length === 0) {
    return ['General'];
  }
  
  // Extract unique muscle group names
  const muscleGroupNames = new Set<string>();
  exerciseType.muscles.forEach(muscle => {
    muscleGroupNames.add(muscle.muscle_group.name);
  });
  
  return Array.from(muscleGroupNames);
}

/**
 * Fallback function for guest mode or when muscle data is not available
 */
export function getExerciseMuscleGroupsFallback(exerciseTypeName: string): string[] {
  // Fallback mapping for common exercise keywords when API data is not available
  const EXERCISE_KEYWORD_MAPPING: Record<string, string[]> = {
    'press': ['Chest', 'Shoulders'],
    'curl': ['Arms'],
    'pull': ['Back'],
    'push': ['Chest'],
    'squat': ['Legs'],
    'row': ['Back'],
    'raise': ['Shoulders'],
    'extension': ['Arms', 'Legs'],
    'fly': ['Chest'],
    'deadlift': ['Back', 'Legs'],
    'lunge': ['Legs'],
    'plank': ['Core'],
    'crunch': ['Core'],
  };

  // Exact matches for common exercises
  const exactMatches: Record<string, string[]> = {
    'Bench Press': ['Chest'],
    'Push-ups': ['Chest', 'Arms'],
    'Squats': ['Legs'],
    'Deadlift': ['Back', 'Legs'],
  };

  // First try exact match
  const exactMatch = exactMatches[exerciseTypeName];
  if (exactMatch) {
    return exactMatch;
  }

  // Then try partial matching with keywords
  const lowerExerciseName = exerciseTypeName.toLowerCase();
  const matchedMuscleGroups = new Set<string>();
  
  for (const [keyword, muscleGroups] of Object.entries(EXERCISE_KEYWORD_MAPPING)) {
    if (lowerExerciseName.includes(keyword)) {
      muscleGroups.forEach(group => matchedMuscleGroups.add(group));
    }
  }
  
  // Return matched groups or default to 'General' if no matches
  return matchedMuscleGroups.size > 0 ? Array.from(matchedMuscleGroups) : ['General'];
}

/**
 * Calculates muscle group summary from exercises
 */
export function calculateMuscleGroupSummary(exercises: Array<{
  exercise_type: ExerciseTypeWithMuscles | { name: string };
  exercise_sets: Array<{ done?: boolean }>;
}>): MuscleGroupSummary[] {
  const muscleGroupCounts = new Map<string, number>();
  
  exercises.forEach(exercise => {
    // Only count completed sets
    const completedSets = exercise.exercise_sets.filter(set => set.done).length;
    
    if (completedSets > 0) {
      let muscleGroups: string[];
      
      // Check if exercise_type has muscles data (from API) or just name (guest mode)
      if ('muscles' in exercise.exercise_type) {
        muscleGroups = getExerciseMuscleGroups(exercise.exercise_type as ExerciseTypeWithMuscles);
      } else {
        muscleGroups = getExerciseMuscleGroupsFallback(exercise.exercise_type.name);
      }
      
      muscleGroups.forEach(muscleGroup => {
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