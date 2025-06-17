import api from './client';

export interface ExerciseType {
  id: number;
  name: string;
  description: string | null;
  default_intensity_unit: number;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: number;
  timestamp: string | null;
  notes: string | null;
  exercise_type_id: number;
  workout_id: number;
  created_at: string;
  updated_at: string;
  exercise_type: ExerciseType;
}

// Get exercises for a specific workout
export const getExercisesInWorkout = async (workoutId: string): Promise<Exercise[]> => {
  const response = await api.get(`/workouts/${workoutId}/exercises`);
  return response.data;
};