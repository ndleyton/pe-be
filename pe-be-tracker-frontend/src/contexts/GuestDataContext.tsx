import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { syncGuestDataToServer, showSyncSuccessToast, showSyncErrorToast } from '@/utils/syncGuestData';
import { generateRandomId, getCurrentUTCTimestamp } from '@/utils/date';

// Guest data interfaces that mirror the server-side structures but with local IDs
export interface GuestExerciseType {
  id: string; // Local UUID for guest data
  name: string;
  description: string | null;
  default_intensity_unit: number;
  times_used: number;
  equipment?: string | null;
  instructions?: string | null;
  category?: string | null;
  created_at?: string;
  updated_at?: string;
  usage_count?: number;
  muscles?: Array<{ id: number; name: string }>;
  muscle_groups?: string[];
}

export interface GuestIntensityUnit {
  id: number; // Keep same as server since these are reference data
  name: string;
  abbreviation: string;
}

export interface GuestExerciseSet {
  id: string; // Local UUID for guest data
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  exercise_id: string; // References local guest exercise ID
  rest_time_seconds: number | null;
  done: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuestExercise {
  id: string; // Local UUID for guest data
  timestamp: string | null;
  notes: string | null;
  exercise_type_id: string; // References local guest exercise type ID
  workout_id: string; // References local guest workout ID
  created_at: string;
  updated_at: string;
  exercise_type: GuestExerciseType;
  exercise_sets: GuestExerciseSet[];
}

export interface GuestWorkoutType {
  id: string; // Local UUID for guest data
  name: string;
  description: string | null;
}

export interface GuestWorkout {
  id: string; // Local UUID for guest data
  name: string | null;
  notes: string | null;
  start_time: string;
  end_time: string | null;
  workout_type_id: string; // References local guest workout type ID
  workout_type: GuestWorkoutType;
  exercises: GuestExercise[];
  created_at: string;
  updated_at: string;
}

export interface GuestRecipeSet {
  id: string;
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  rest_time_seconds: number | null;
}

export interface GuestRecipeExercise {
  id: string;
  exercise_type_id: string;
  exercise_type: GuestExerciseType;
  sets: GuestRecipeSet[];
  notes: string | null;
}

export interface GuestRecipe {
  id: string;
  name: string;
  description?: string;
  exercises: GuestRecipeExercise[];
  created_at: string;
  updated_at: string;
}

export interface GuestData {
  workouts: GuestWorkout[];
  exerciseTypes: GuestExerciseType[];
  workoutTypes: GuestWorkoutType[];
  recipes: GuestRecipe[];
}

// Action types
export interface GuestDataActions {
  // Workout actions
  addWorkout: (workout: Omit<GuestWorkout, 'id' | 'created_at' | 'updated_at'>) => string;
  updateWorkout: (id: string, updates: Partial<GuestWorkout>) => void;
  deleteWorkout: (id: string) => void;
  
  // Exercise actions
  addExercise: (exercise: Omit<GuestExercise, 'id' | 'created_at' | 'updated_at' | 'exercise_sets'>) => string;
  updateExercise: (id: string, updates: Partial<GuestExercise>) => void;
  deleteExercise: (id: string) => void;
  
  // Exercise set actions
  addExerciseSet: (exerciseSet: Omit<GuestExerciseSet, 'id' | 'created_at' | 'updated_at'>) => string;
  updateExerciseSet: (id: string, updates: Partial<GuestExerciseSet>) => void;
  deleteExerciseSet: (id: string) => void;
  
  // Exercise type actions
  addExerciseType: (exerciseType: Omit<GuestExerciseType, 'id' | 'times_used'>) => string;
  updateExerciseType: (id: string, updates: Partial<GuestExerciseType>) => void;
  
  // Workout type actions
  addWorkoutType: (workoutType: Omit<GuestWorkoutType, 'id'>) => string;
  updateWorkoutType: (id: string, updates: Partial<GuestWorkoutType>) => void;
  
  // Recipe actions
  addRecipe: (recipe: Omit<GuestRecipe, 'id' | 'created_at' | 'updated_at'>) => string;
  deleteRecipe: (id: string) => void;
  createRecipeFromWorkout: (workoutName: string, exercises: GuestExercise[]) => string;
  createExercisesFromRecipe: (recipe: GuestRecipe, workoutId: string) => string[];
  
  // Utility actions
  clear: () => void;
  getWorkout: (id: string) => GuestWorkout | undefined;
  getExercise: (id: string) => GuestExercise | undefined;
}

interface GuestDataContextType {
  data: GuestData;
  actions: GuestDataActions;
  isAuthenticated: () => boolean;
}

const GuestDataContext = createContext<GuestDataContextType | undefined>(undefined);

const GUEST_DATA_KEY = 'pe-guest-data';

// Utility functions (use secure implementations from date utils)
const generateId = generateRandomId;
const getCurrentTimestamp = getCurrentUTCTimestamp;

// Initial data with default exercise types and workout types
const getInitialGuestData = (): GuestData => ({
  workouts: [],
  exerciseTypes: [
    // Most Popular Compound Movements
    {
      id: '105',
      name: 'Barbell Squat',
      description: 'Lower body compound exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 7, name: 'Hamstrings' }, { id: 23, name: 'Glutes' }],
      muscle_groups: ['Legs'],
    },
    {
      id: '88',
      name: 'Barbell Deadlift',
      description: 'Full body strength exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 7, name: 'Hamstrings' }, { id: 23, name: 'Glutes' }, { id: 24, name: 'Lower Back' }, { id: 10, name: 'Traps' }],
      muscle_groups: ['Legs', 'Back'],
    },
    {
      id: '84',
      name: 'Barbell Bench Press - Medium Grip',
      description: 'Upper body pressing exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 1, name: 'Pectoralis Major' }, { id: 13, name: 'Triceps' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Chest', 'Arms', 'Shoulders'],
    },
    {
      id: '600',
      name: 'Pullups',
      description: 'Upper body pulling exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Pull-up bar',
      category: 'Strength',
      muscles: [{ id: 19, name: 'Lats' }, { id: 16, name: 'Biceps' }, { id: 14, name: 'Middle Back' }],
      muscle_groups: ['Back', 'Arms'],
    },
    {
      id: '6',
      name: 'Push-ups',
      description: 'Upper body bodyweight exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Bodyweight',
      category: 'Bodyweight',
      muscles: [{ id: 9, name: 'Chest' }, { id: 13, name: 'Triceps' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Chest', 'Arms', 'Shoulders'],
    },
    
    // Upper Body Push
    {
      id: '100',
      name: 'Barbell Shoulder Press',
      description: 'Standing shoulder press',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 15, name: 'Shoulders' }, { id: 13, name: 'Triceps' }, { id: 9, name: 'Chest' }],
      muscle_groups: ['Shoulders', 'Arms', 'Chest'],
    },
    {
      id: '262',
      name: 'Dumbbell Bench Press',
      description: 'Chest press with dumbbells',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Strength',
      muscles: [{ id: 9, name: 'Chest' }, { id: 13, name: 'Triceps' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Chest', 'Arms', 'Shoulders'],
    },
    {
      id: '94',
      name: 'Barbell Incline Bench Press - Medium Grip',
      description: 'Upper chest focus bench press',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 9, name: 'Chest' }, { id: 13, name: 'Triceps' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Chest', 'Arms', 'Shoulders'],
    },
    {
      id: '577',
      name: 'Parallel Bar Dip',
      description: 'Bodyweight tricep and chest exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Parallel bars',
      category: 'Bodyweight',
      muscles: [{ id: 13, name: 'Triceps' }, { id: 9, name: 'Chest' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Arms', 'Chest', 'Shoulders'],
    },
    
    // Upper Body Pull
    {
      id: '121',
      name: 'Bent Over Barbell Row',
      description: 'Bent over rowing exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 19, name: 'Lats' }, { id: 14, name: 'Middle Back' }, { id: 16, name: 'Biceps' }],
      muscle_groups: ['Back', 'Arms'],
    },
    {
      id: generateId(),
      name: 'T-Bar Rows',
      description: 'T-bar rowing exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'T-bar',
      category: 'Strength',
      muscles: [{ id: 19, name: 'Lats' }, { id: 14, name: 'Middle Back' }, { id: 16, name: 'Biceps' }],
      muscle_groups: ['Back', 'Arms'],
    },
    {
      id: '897',
      name: 'Wide-Grip Lat Pulldown',
      description: 'Cable lat pulldown',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Cable machine',
      category: 'Strength',
      muscles: [{ id: 19, name: 'Lats' }, { id: 16, name: 'Biceps' }, { id: 14, name: 'Middle Back' }],
      muscle_groups: ['Back', 'Arms'],
    },
    {
      id: '200',
      name: 'Chin-Up',
      description: 'Underhand grip pull-ups',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Pull-up bar',
      category: 'Bodyweight',
      muscles: [{ id: 16, name: 'Biceps' }, { id: 19, name: 'Lats' }, { id: 14, name: 'Middle Back' }],
      muscle_groups: ['Arms', 'Back'],
    },
    
    // Leg Exercises
    {
      id: '645',
      name: 'Romanian Deadlift',
      description: 'Hip hinge deadlift variation',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 7, name: 'Hamstrings' }, { id: 23, name: 'Glutes' }, { id: 24, name: 'Lower Back' }],
      muscle_groups: ['Legs', 'Back'],
    },
    {
      id: '775',
      name: 'Split Squats',
      description: 'Single leg squat variation',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Strength',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 23, name: 'Glutes' }, { id: 7, name: 'Hamstrings' }],
      muscle_groups: ['Legs'],
    },
    {
      id: '455',
      name: 'Leg Press',
      description: 'Machine leg press',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Leg press machine',
      category: 'Strength',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 23, name: 'Glutes' }, { id: 7, name: 'Hamstrings' }],
      muscle_groups: ['Legs'],
    },
    {
      id: '271',
      name: 'Dumbbell Lunges',
      description: 'Forward stepping leg exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Bodyweight',
      category: 'Bodyweight',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 23, name: 'Glutes' }, { id: 7, name: 'Hamstrings' }],
      muscle_groups: ['Legs'],
    },
    {
      id: '686',
      name: 'Seated Leg Curl',
      description: 'Hamstring isolation exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Machine',
      category: 'Isolation',
      muscles: [{ id: 7, name: 'Hamstrings' }],
      muscle_groups: ['Legs'],
    },
    {
      id: '453',
      name: 'Leg Extensions',
      description: 'Quadriceps isolation exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Machine',
      category: 'Isolation',
      muscles: [{ id: 6, name: 'Quadriceps' }],
      muscle_groups: ['Legs'],
    },
    {
      id: '177',
      name: 'Calf Press',
      description: 'Standing calf exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Machine or bodyweight',
      category: 'Isolation',
      muscles: [{ id: 11, name: 'Calves' }],
      muscle_groups: ['Legs'],
    },
    {
      id: '93',
      name: 'Barbell Hip Thrust',
      description: 'Glute focused exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 23, name: 'Glutes' }, { id: 7, name: 'Hamstrings' }],
      muscle_groups: ['Legs'],
    },
    
    // Arm Exercises
    {
      id: '85',
      name: 'Barbell Curl',
      description: 'Bicep isolation exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Isolation',
      muscles: [{ id: 16, name: 'Biceps' }, { id: 17, name: 'Forearms' }],
      muscle_groups: ['Arms'],
    },
    {
      id: '52',
      name: 'Alternate Incline Dumbbell Curl',
      description: 'Dumbbell bicep curls',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Isolation',
      muscles: [{ id: 16, name: 'Biceps' }, { id: 17, name: 'Forearms' }],
      muscle_groups: ['Arms'],
    },
    {
      id: '354',
      name: 'Hammer Curls',
      description: 'Neutral grip dumbbell curls',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Isolation',
      muscles: [{ id: 16, name: 'Biceps' }, { id: 17, name: 'Forearms' }],
      muscle_groups: ['Arms'],
    },
    {
      id: generateId(),
      name: 'Close Grip Bench Press',
      description: 'Tricep focused bench press',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 13, name: 'Triceps' }, { id: 9, name: 'Chest' }],
      muscle_groups: ['Arms', 'Chest'],
    },
    {
      id: '798',
      name: 'Standing Dumbbell Triceps Extension',
      description: 'Overhead tricep exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Isolation',
      muscles: [{ id: 13, name: 'Triceps' }],
      muscle_groups: ['Arms'],
    },
    {
      id: generateId(),
      name: 'Cable Tricep Pushdowns',
      description: 'Cable tricep isolation',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Cable machine',
      category: 'Isolation',
      muscles: [{ id: 13, name: 'Triceps' }],
      muscle_groups: ['Arms'],
    },
    
    // Shoulder Exercises
    {
      id: '707',
      name: 'Side Lateral Raise',
      description: 'Side shoulder raise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Isolation',
      muscles: [{ id: 15, name: 'Shoulders' }],
      muscle_groups: ['Shoulders'],
    },
    {
      id: '334',
      name: 'Front Dumbbell Raise',
      description: 'Front shoulder raise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Isolation',
      muscles: [{ id: 15, name: 'Shoulders' }],
      muscle_groups: ['Shoulders'],
    },
    {
      id: '630',
      name: 'Reverse Flyes',
      description: 'Rear deltoid isolation',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Isolation',
      muscles: [{ id: 15, name: 'Shoulders' }, { id: 14, name: 'Middle Back' }],
      muscle_groups: ['Shoulders', 'Back'],
    },
    {
      id: generateId(),
      name: 'Upright Rows',
      description: 'Vertical pulling exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Barbell',
      category: 'Strength',
      muscles: [{ id: 15, name: 'Shoulders' }, { id: 10, name: 'Traps' }],
      muscle_groups: ['Shoulders', 'Back'],
    },
    {
      id: '286',
      name: 'Dumbbell Shrug',
      description: 'Trapezius exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Isolation',
      muscles: [{ id: 10, name: 'Traps' }, { id: 22, name: 'Neck' }],
      muscle_groups: ['Back'],
    },
    
    // Core Exercises
    {
      id: '581',
      name: 'Plank',
      description: 'Isometric core exercise',
      default_intensity_unit: 4, // time
      times_used: 0,
      equipment: 'Bodyweight',
      category: 'Core',
      muscles: [{ id: 21, name: 'Abdominals' }, { id: 24, name: 'Lower Back' }],
      muscle_groups: ['Core'],
    },
    {
      id: '229',
      name: 'Crunches',
      description: 'Basic abdominal exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Bodyweight',
      category: 'Core',
      muscles: [{ id: 21, name: 'Abdominals' }],
      muscle_groups: ['Core'],
    },
    {
      id: '655',
      name: 'Russian Twist',
      description: 'Rotational core exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Bodyweight',
      category: 'Core',
      muscles: [{ id: 21, name: 'Abdominals' }],
      muscle_groups: ['Core'],
    },
    {
      id: generateId(),
      name: 'Mountain Climbers',
      description: 'Dynamic core and cardio exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Bodyweight',
      category: 'Cardio',
      muscles: [{ id: 21, name: 'Abdominals' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Core', 'Shoulders'],
    },
    {
      id: generateId(),
      name: 'Hanging Leg Raises',
      description: 'Advanced core exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Pull-up bar',
      category: 'Core',
      muscles: [{ id: 21, name: 'Abdominals' }, { id: 17, name: 'Forearms' }],
      muscle_groups: ['Core', 'Arms'],
    },
    {
      id: '43',
      name: 'Ab Roller',
      description: 'Advanced core strengthening',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Ab wheel',
      category: 'Core',
      muscles: [{ id: 21, name: 'Abdominals' }, { id: 24, name: 'Lower Back' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Core', 'Shoulders'],
    },
    
    // Cardio/Functional
    {
      id: generateId(),
      name: 'Burpees',
      description: 'Full body conditioning exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Bodyweight',
      category: 'Cardio',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 9, name: 'Chest' }, { id: 21, name: 'Abdominals' }],
      muscle_groups: ['Legs', 'Chest', 'Core'],
    },
    {
      id: generateId(),
      name: 'Kettlebell Swings',
      description: 'Hip hinge power exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Kettlebell',
      category: 'Functional',
      muscles: [{ id: 23, name: 'Glutes' }, { id: 7, name: 'Hamstrings' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Legs', 'Shoulders'],
    },
    {
      id: generateId(),
      name: 'Thrusters',
      description: 'Squat to press combination',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Functional',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 15, name: 'Shoulders' }, { id: 21, name: 'Abdominals' }],
      muscle_groups: ['Legs', 'Shoulders', 'Core'],
    },
    {
      id: generateId(),
      name: 'Farmer\'s Walk',
      description: 'Loaded carry exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Dumbbells',
      category: 'Functional',
      muscles: [{ id: 17, name: 'Forearms' }, { id: 10, name: 'Traps' }, { id: 21, name: 'Abdominals' }],
      muscle_groups: ['Arms', 'Back', 'Core'],
    },
    {
      id: generateId(),
      name: 'Box Jumps',
      description: 'Plyometric leg exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
      equipment: 'Plyo box',
      category: 'Plyometric',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 23, name: 'Glutes' }, { id: 11, name: 'Calves' }],
      muscle_groups: ['Legs'],
    },
    {
      id: generateId(),
      name: 'Battle Ropes',
      description: 'High intensity conditioning',
      default_intensity_unit: 4, // time
      times_used: 0,
      equipment: 'Battle ropes',
      category: 'Cardio',
      muscles: [{ id: 15, name: 'Shoulders' }, { id: 21, name: 'Abdominals' }, { id: 17, name: 'Forearms' }],
      muscle_groups: ['Shoulders', 'Core', 'Arms'],
    },
    
    // Machine/Cable Exercises
    {
      id: generateId(),
      name: 'Cable Flyes',
      description: 'Cable chest isolation',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Cable machine',
      category: 'Isolation',
      muscles: [{ id: 9, name: 'Chest' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Chest', 'Shoulders'],
    },
    {
      id: generateId(),
      name: 'Cable Rows',
      description: 'Seated cable rowing',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Cable machine',
      category: 'Strength',
      muscles: [{ id: 19, name: 'Lats' }, { id: 14, name: 'Middle Back' }, { id: 16, name: 'Biceps' }],
      muscle_groups: ['Back', 'Arms'],
    },
    {
      id: generateId(),
      name: 'Machine Shoulder Press',
      description: 'Seated shoulder press machine',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Machine',
      category: 'Strength',
      muscles: [{ id: 15, name: 'Shoulders' }, { id: 13, name: 'Triceps' }],
      muscle_groups: ['Shoulders', 'Arms'],
    },
    {
      id: '4',
      name: 'Machine Chest Press',
      description: 'Machine chest press',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Machine',
      category: 'Strength',
      muscles: [{ id: 9, name: 'Chest' }, { id: 13, name: 'Triceps' }, { id: 15, name: 'Shoulders' }],
      muscle_groups: ['Chest', 'Arms', 'Shoulders'],
    },
    {
      id: generateId(),
      name: 'Smith Machine Squats',
      description: 'Guided barbell squats',
      default_intensity_unit: 2, // kg
      times_used: 0,
      equipment: 'Smith machine',
      category: 'Strength',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 23, name: 'Glutes' }, { id: 7, name: 'Hamstrings' }],
      muscle_groups: ['Legs'],
    },
    
    // Stretching/Mobility
    {
      id: '39',
      name: 'Walking',
      description: 'Low intensity cardio',
      default_intensity_unit: 4, // time
      times_used: 0,
      equipment: 'None',
      category: 'Cardio',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 7, name: 'Hamstrings' }, { id: 11, name: 'Calves' }],
      muscle_groups: ['Legs'],
    },
    {
      id: generateId(),
      name: 'Running',
      description: 'Cardiovascular exercise',
      default_intensity_unit: 4, // time
      times_used: 0,
      equipment: 'None',
      category: 'Cardio',
      muscles: [{ id: 6, name: 'Quadriceps' }, { id: 7, name: 'Hamstrings' }, { id: 11, name: 'Calves' }],
      muscle_groups: ['Legs'],
    },
  ],
  workoutTypes: [
    {
      id: generateId(),
      name: 'Strength Training',
      description: 'Traditional weightlifting session',
    },
    {
      id: generateId(),
      name: 'Cardio',
      description: 'Cardiovascular exercise session',
    },
    {
      id: generateId(),
      name: 'Bodyweight',
      description: 'Exercises using your own body weight',
    },
    {
      id: generateId(),
      name: 'Other',
      description: 'General workout session',
    },
  ],
  recipes: [],
});

export const useGuestData = () => {
  const context = useContext(GuestDataContext);
  if (context === undefined) {
    throw new Error('useGuestData must be used within a GuestDataProvider');
  }
  return context;
};

interface GuestDataProviderProps {
  children: ReactNode;
}

// Migration function to ensure recipes property exists
const migrateGuestData = (data: any): GuestData => {
  const migrated = { ...data };
  
  // Add recipes array if it doesn't exist
  if (!migrated.recipes) {
    migrated.recipes = [];
  }
  
  return migrated as GuestData;
};

export const GuestDataProvider: React.FC<GuestDataProviderProps> = ({ children }) => {
  const [data, setData] = useState<GuestData>(() => {
    try {
      const stored = localStorage.getItem(GUEST_DATA_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return migrateGuestData(parsed);
      }
      return getInitialGuestData();
    } catch {
      return getInitialGuestData();
    }
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save guest data to localStorage:', error);
    }
  }, [data]);

  const { isAuthenticated: authIsAuthenticated, user } = useAuth();

  const isAuthenticated = (): boolean => authIsAuthenticated();

  // Automatically sync guest data once after the user logs in
  const hasAttemptedSync = React.useRef(false);

  React.useEffect(() => {
    if (user && data.workouts.length > 0 && !hasAttemptedSync.current) {
      hasAttemptedSync.current = true;
      (async () => {
        const result = await syncGuestDataToServer(data, actions.clear);
        if (result.success) {
          showSyncSuccessToast(result);
        } else {
          showSyncErrorToast(result.error ?? 'Unknown error');
        }
      })();
    }
  }, [user, data]);

  const actions: GuestDataActions = {
    // Workout actions
    addWorkout: (workout) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      const newWorkout: GuestWorkout = {
        ...workout,
        id,
        created_at: now,
        updated_at: now,
      };
      setData(prev => ({
        ...prev,
        workouts: [...prev.workouts, newWorkout],
      }));
      return id;
    },

    updateWorkout: (id, updates) => {
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout =>
          workout.id === id
            ? { ...workout, ...updates, updated_at: getCurrentTimestamp() }
            : workout
        ),
      }));
    },

    deleteWorkout: (id) => {
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.filter(workout => workout.id !== id),
      }));
    },

    // Exercise actions
    addExercise: (exercise) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      const newExercise: GuestExercise = {
        ...exercise,
        id,
        exercise_sets: [],
        created_at: now,
        updated_at: now,
      };

      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout =>
          workout.id === exercise.workout_id
            ? {
                ...workout,
                exercises: [...workout.exercises, newExercise],
                updated_at: now,
              }
            : workout
        ),
      }));
      return id;
    },

    updateExercise: (id, updates) => {
      const now = getCurrentTimestamp();
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.map(exercise =>
            exercise.id === id
              ? { ...exercise, ...updates, updated_at: now }
              : exercise
          ),
        })),
      }));
    },

    deleteExercise: (id) => {
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.filter(exercise => exercise.id !== id),
        })),
      }));
    },

    // Exercise set actions
    addExerciseSet: (exerciseSet) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      const newExerciseSet: GuestExerciseSet = {
        ...exerciseSet,
        id,
        created_at: now,
        updated_at: now,
      };

      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.map(exercise =>
            exercise.id === exerciseSet.exercise_id
              ? {
                  ...exercise,
                  exercise_sets: [...exercise.exercise_sets, newExerciseSet],
                  updated_at: now,
                }
              : exercise
          ),
        })),
      }));
      return id;
    },

    updateExerciseSet: (id, updates) => {
      const now = getCurrentTimestamp();
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.map(exercise => ({
            ...exercise,
            exercise_sets: exercise.exercise_sets.map(set =>
              set.id === id
                ? { ...set, ...updates, updated_at: now }
                : set
            ),
          })),
        })),
      }));
    },

    deleteExerciseSet: (id) => {
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.map(exercise => ({
            ...exercise,
            exercise_sets: exercise.exercise_sets.filter(set => set.id !== id),
          })),
        })),
      }));
    },

    // Exercise type actions
    addExerciseType: (exerciseType) => {
      const id = generateId();
      const newExerciseType: GuestExerciseType = {
        ...exerciseType,
        id,
        times_used: 0,
      };
      setData(prev => ({
        ...prev,
        exerciseTypes: [...prev.exerciseTypes, newExerciseType],
      }));
      return id;
    },

    updateExerciseType: (id, updates) => {
      setData(prev => ({
        ...prev,
        exerciseTypes: prev.exerciseTypes.map(type =>
          type.id === id ? { ...type, ...updates } : type
        ),
      }));
    },

    // Workout type actions
    addWorkoutType: (workoutType) => {
      const id = generateId();
      const newWorkoutType: GuestWorkoutType = {
        ...workoutType,
        id,
      };
      setData(prev => ({
        ...prev,
        workoutTypes: [...prev.workoutTypes, newWorkoutType],
      }));
      return id;
    },

    updateWorkoutType: (id, updates) => {
      setData(prev => ({
        ...prev,
        workoutTypes: prev.workoutTypes.map(type =>
          type.id === id ? { ...type, ...updates } : type
        ),
      }));
    },

    // Recipe actions
    addRecipe: (recipe) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      const newRecipe: GuestRecipe = {
        ...recipe,
        id,
        created_at: now,
        updated_at: now,
      };
      setData(prev => ({
        ...prev,
        recipes: [...(prev.recipes || []), newRecipe],
      }));
      return id;
    },

    deleteRecipe: (id) => {
      setData(prev => ({
        ...prev,
        recipes: (prev.recipes || []).filter(recipe => recipe.id !== id),
      }));
    },

    createRecipeFromWorkout: (workoutName, exercises) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      
      const recipeExercises: GuestRecipeExercise[] = exercises.map(exercise => ({
        id: generateId(),
        exercise_type_id: exercise.exercise_type_id,
        exercise_type: exercise.exercise_type,
        sets: exercise.exercise_sets.map(set => ({
          id: generateId(),
          reps: set.reps,
          intensity: set.intensity,
          intensity_unit_id: set.intensity_unit_id,
          rest_time_seconds: set.rest_time_seconds,
        })),
        notes: exercise.notes || null,
      }));

      const newRecipe: GuestRecipe = {
        id,
        name: workoutName || 'My Recipe',
        exercises: recipeExercises,
        created_at: now,
        updated_at: now,
      };

      setData(prev => ({
        ...prev,
        recipes: [...(prev.recipes || []), newRecipe],
      }));
      
      return id;
    },

    createExercisesFromRecipe: (recipe, workoutId) => {
      const exerciseIds: string[] = [];
      
      recipe.exercises.forEach(recipeExercise => {
        // Create exercise from recipe
        const exerciseId = actions.addExercise({
          workout_id: workoutId,
          exercise_type_id: recipeExercise.exercise_type_id,
          exercise_type: recipeExercise.exercise_type,
          notes: recipeExercise.notes,
          timestamp: getCurrentTimestamp(),
        });
        
        exerciseIds.push(exerciseId);
        
        // Create sets from recipe
        recipeExercise.sets.forEach(recipeSet => {
          actions.addExerciseSet({
            exercise_id: exerciseId,
            reps: recipeSet.reps,
            intensity: recipeSet.intensity,
            intensity_unit_id: recipeSet.intensity_unit_id,
            rest_time_seconds: recipeSet.rest_time_seconds,
            done: false,
          });
        });
      });
      
      return exerciseIds;
    },

    // Utility actions
    clear: () => {
      setData(getInitialGuestData());
      try {
        localStorage.removeItem(GUEST_DATA_KEY);
      } catch (error) {
        console.warn('Failed to clear guest data from localStorage:', error);
      }
    },

    getWorkout: (id) => {
      return data.workouts.find(workout => workout.id === id);
    },

    getExercise: (id) => {
      for (const workout of data.workouts) {
        const exercise = workout.exercises.find(ex => ex.id === id);
        if (exercise) return exercise;
      }
      return undefined;
    },
  };

  const contextValue: GuestDataContextType = {
    data,
    actions,
    isAuthenticated,
  };

  return (
    <GuestDataContext.Provider value={contextValue}>
      {children}
    </GuestDataContext.Provider>
  );
};