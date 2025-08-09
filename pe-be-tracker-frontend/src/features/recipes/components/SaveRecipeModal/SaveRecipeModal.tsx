import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGuestStore, useAuthStore, GuestExercise } from '@/stores';
import { Exercise, updateExerciseSet } from '@/features/exercises/api';
import { createRecipe, CreateRecipeData } from '@/features/recipes/api';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';

interface SaveRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutName: string;
  exercises: Exercise[];
  workoutId?: string;
}

// Helper function to convert Exercise[] to GuestExercise[] format
const convertToGuestExercises = (exercises: Exercise[]): GuestExercise[] => {
  return exercises.map((exercise): GuestExercise => ({
    id: exercise.id as string,
    timestamp: exercise.timestamp,
    notes: exercise.notes,
    exercise_type_id: exercise.exercise_type_id as string,
    workout_id: exercise.workout_id as string,
    created_at: exercise.created_at,
    updated_at: exercise.updated_at,
    exercise_type: {
      id: exercise.exercise_type.id.toString(),
      name: exercise.exercise_type.name,
      description: exercise.exercise_type.description,
      default_intensity_unit: exercise.exercise_type.default_intensity_unit,
      times_used: exercise.exercise_type.times_used || 0,
    },
    exercise_sets: exercise.exercise_sets.map(set => ({
      id: set.id as string,
      reps: set.reps,
      intensity: set.intensity,
      intensity_unit_id: set.intensity_unit_id,
      exercise_id: set.exercise_id as string,
      rest_time_seconds: set.rest_time_seconds,
      done: set.done,
      created_at: set.created_at,
      updated_at: set.updated_at,
    })),
  }));
};

export const SaveRecipeModal: React.FC<SaveRecipeModalProps> = ({
  isOpen,
  onClose,
  workoutName,
  exercises,
  workoutId,
}) => {
  // Get state from stores
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const guestActions = useGuestStore();
  const queryClient = useQueryClient();
  const [recipeName, setRecipeName] = useState(workoutName || 'My Routine');
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to update exercise sets done status
  const updateExerciseSetsDoneStatus = async () => {
    if (!isAuthenticated) return; // Only for authenticated users
    
    // Get all exercise sets that need to be updated
    const setsToUpdate = exercises.flatMap(exercise => 
      exercise.exercise_sets.map(set => ({
        id: set.id,
        done: set.done
      }))
    );
    
    // Update all sets in parallel
    await Promise.all(
      setsToUpdate.map(set => 
        updateExerciseSet(set.id, { done: set.done })
      )
    );
  };

  const handleSave = async () => {
    if (!recipeName.trim()) return;
    
    setIsLoading(true);
    try {
      if (isAuthenticated) {
        // First, update the exercise sets' done status
        await updateExerciseSetsDoneStatus();
        
        // Then create the recipe
        const recipeData: CreateRecipeData = {
          name: recipeName,
          workout_type_id: 1, // Default workout type - could be made configurable
          exercise_templates: exercises.map(exercise => {
            // Removed debug log: Processing exercise details
            // Removed debug log: Exercise sets
            
            return {
              exercise_type_id: exercise.exercise_type_id as number,
              set_templates: exercise.exercise_sets.map(set => {
                const setTemplate = {
                  reps: set.reps || 0,
                  intensity: set.intensity || 0,
                  intensity_unit_id: set.intensity_unit_id,
                };
                return setTemplate;
              }),
            };
          }),
        };
        
        
        const createdRecipe = await createRecipe(recipeData);
        
        // Invalidate routines query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['routines'] });
        // Invalidate exercises query to refresh the workout exercises
        if (workoutId) {
          queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
        }
      } else {
        // For guest users, use the existing local storage approach
        const guestExercises = convertToGuestExercises(exercises);
        guestActions.createRecipeFromWorkout(recipeName, guestExercises);
      }
      
      onClose();
      setRecipeName('');
    } catch (error) {
      console.error('Error saving recipe:', error);
      // Could add toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
    setRecipeName(workoutName || 'My Routine');
  };

  const exerciseCount = exercises.length;
  const totalSets = exercises.reduce((total, exercise) => total + exercise.exercise_sets.length, 0);

  return (
    <Sheet open={isOpen} onOpenChange={handleCancel}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Save as Routine</SheetTitle>
          <SheetDescription>
            Create a reusable routine from this workout with {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} and {totalSets} set{totalSets !== 1 ? 's' : ''}.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="routine-name" className="text-sm font-medium">Routine Name</label>
            <Input
              id="routine-name"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="Enter routine name"
            />
          </div>
          <div className="bg-muted rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2">Exercises to include:</h4>
            <div className="space-y-1">
              {exercises.map((exercise) => (
                <div key={exercise.id} className="text-sm text-muted-foreground">
                  {exercise.exercise_type.name} • {exercise.exercise_sets.length} set{exercise.exercise_sets.length !== 1 ? 's' : ''}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!recipeName.trim() || isLoading} className="flex-1">
            {isLoading ? 'Saving...' : 'Save Routine'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};