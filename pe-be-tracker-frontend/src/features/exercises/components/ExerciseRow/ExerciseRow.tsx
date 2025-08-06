import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Exercise, ExerciseSet, IntensityUnit, updateExerciseSet, createExerciseSet, deleteExerciseSet, CreateExerciseSetData, UpdateExerciseSetData } from '@/features/exercises/api';
import { GuestExerciseSet } from '@/stores';
import { useAuthStore } from '@/stores';
import { AddExerciseSetForm } from '@/features/exercise-sets/components';
import { ExerciseTypeMore } from '@/features/exercises/components/ExerciseTypeMore';
import { Card, CardHeader, CardContent, Button, Input, Badge, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, Textarea } from '@/shared/components/ui';
import { MoreVertical, Timer, StickyNote, Plus, Minus, Check, Trash2 } from 'lucide-react';
import { formatDisplayDate } from '@/utils/date';
import { truncateWords } from '@/utils/text';
import { useDebounce } from '@/shared/hooks';

// Guest intensity unit type (simplified)
interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

interface ExerciseRowProps {
  exercise: Exercise;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
  workoutId?: string;
}


interface RestTimer {
  minutes: number;
  seconds: number;
}

interface NotesModalState {
  exerciseId: string | number;
  setId: string | number;
}

interface MoreMenuModalState {
  exerciseId: string | number;
  setId: string | number;
}

const ExerciseRow: React.FC<ExerciseRowProps> = ({ exercise, onExerciseUpdate, workoutId }) => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  
  const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>(exercise.exercise_sets || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [exerciseNotesModal, setExerciseNotesModal] = useState(false);
  const [exerciseNotesValue, setExerciseNotesValue] = useState<string>('');
  const [notesModal, setNotesModal] = useState<NotesModalState | null>(null);
  const [setNotesValue, setSetNotesValue] = useState<string>('');
  const debouncedSetNotesValue = useDebounce(setNotesValue, 1000); // 1 second delay for set notes
  const [initialSetNotesValue, setInitialSetNotesValue] = useState<string>('');
  const [moreMenuModal, setMoreMenuModal] = useState<MoreMenuModalState | null>(null);
  const [restTimer] = useState<RestTimer>({ minutes: 2, seconds: 30 });
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  
  // Default intensity unit based on exercise type or fallback
  const [currentIntensityUnit, setCurrentIntensityUnit] = useState<IntensityUnit | GuestIntensityUnit>(() => {
    // Try to get from exercise type default, otherwise fallback to kg
    return {
      id: 2,
      name: 'Kilograms',
      abbreviation: 'kg'
    };
  });
  

  // Helper function to update exercise notes
  const updateExerciseNotes = (notes: string) => {
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        notes: notes
      });
    }
  };

  // Effect to update set notes when debounced value changes
  useEffect(() => {
    if (notesModal && debouncedSetNotesValue !== initialSetNotesValue) {
      // Find the current set to check if notes actually changed
      const currentSet = exerciseSets.find(set => set.id === notesModal.setId);
      if (currentSet && debouncedSetNotesValue !== (currentSet.notes || '')) {
        updateSetNotes(notesModal.exerciseId, notesModal.setId, debouncedSetNotesValue);
      }
    }
  }, [debouncedSetNotesValue, notesModal, exerciseSets, initialSetNotesValue]);

  // Helper function to convert ExerciseSet to GuestExerciseSet for guest mode
  const convertToGuestExerciseSets = (sets: ExerciseSet[]): GuestExerciseSet[] => {
    return sets.map(set => ({
      ...set,
      id: String(set.id),
      exercise_id: String(set.exercise_id)
    }));
  };

  const handleSetAdded = (newSet: ExerciseSet | GuestExerciseSet) => {
    const updatedSets = [...exerciseSets, newSet];
    setExerciseSets(updatedSets);
    setShowAddForm(false);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated ? updatedSets : convertToGuestExerciseSets(updatedSets)
      });
    }
  };

  const updateSet = async (exerciseId: string | number, setId: string | number, field: 'weight' | 'reps', value: number) => {
    // Optimistic update: Update local state immediately
    const updatedSets = exerciseSets.map(set => {
      if (set.id === setId) {
        return {
          ...set,
          [field === 'weight' ? 'intensity' : 'reps']: value
        };
      }
      return set;
    });
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated ? updatedSets : convertToGuestExerciseSets(updatedSets)
      });
    }

    if (isAuthenticated) {
      try {
        // Call API to persist the change
        const updateData: UpdateExerciseSetData = {};
        if (field === 'weight') {
          updateData.intensity = value;
        } else {
          updateData.reps = value;
        }
        
        await updateExerciseSet(setId, updateData);
        
        // Optionally invalidate queries to ensure consistency (but UI already updated)
        // queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
      } catch (error) {
        console.error('Failed to update exercise set:', error);
        
        // Rollback: Revert to original state
        setExerciseSets(exercise.exercise_sets || []);
        if (onExerciseUpdate) {
          onExerciseUpdate({
            ...exercise,
            exercise_sets: isAuthenticated ? exercise.exercise_sets : convertToGuestExerciseSets(exercise.exercise_sets)
          });
        }
        
        // TODO: Add toast notification when available
      }
    }
  };

  const incrementReps = (exerciseId: string | number, setId: string | number) => {
    const currentSet = exerciseSets.find(s => s.id === setId);
    const newReps = (currentSet?.reps || 0) + 1;
    updateSet(exerciseId, setId, 'reps', newReps);
  };

  const decrementReps = (exerciseId: string | number, setId: string | number) => {
    const currentSet = exerciseSets.find(s => s.id === setId);
    const newReps = Math.max((currentSet?.reps || 0) - 1, 0);
    updateSet(exerciseId, setId, 'reps', newReps);
  };

  const toggleSetCompletion = async (exerciseId: string | number, setId: string | number) => {
    // Find the current set to get its completion status
    const currentSet = exerciseSets.find(set => set.id === setId);
    if (!currentSet) return;
    
    // Optimistic update: Update local state immediately
    const updatedSets = exerciseSets.map(set => {
      if (set.id === setId) {
        return {
          ...set,
          done: !set.done
        };
      }
      return set;
    });
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated ? updatedSets : convertToGuestExerciseSets(updatedSets)
      });
    }

    if (isAuthenticated) {
      try {
        const updateData: UpdateExerciseSetData = {
          done: !currentSet.done
        };
        
        await updateExerciseSet(setId, updateData);
        
        // Optionally invalidate queries to ensure consistency (but UI already updated)
        // queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
      } catch (error) {
        console.error('Failed to toggle exercise set completion:', error);
        
        // Rollback: Revert to original state
        setExerciseSets(exercise.exercise_sets || []);
        if (onExerciseUpdate) {
          onExerciseUpdate({
            ...exercise,
            exercise_sets: isAuthenticated ? exercise.exercise_sets : convertToGuestExerciseSets(exercise.exercise_sets)
          });
        }
        
        // TODO: Add toast notification when available
      }
    }
  };

  const updateSetNotes = async (exerciseId: string | number, setId: string | number, notes: string) => {
    // Optimistic update: Update local state immediately
    const updatedSets = exerciseSets.map(set => {
      if (set.id === setId) {
        return {
          ...set,
          notes: notes
        };
      }
      return set;
    });
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated ? updatedSets : convertToGuestExerciseSets(updatedSets)
      });
    }

    if (isAuthenticated) {
      try {
        const updateData: UpdateExerciseSetData = {
          notes: notes
        };
        
        await updateExerciseSet(setId, updateData);
        
        // Optionally invalidate queries to ensure consistency (but UI already updated)
        // queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
      } catch (error) {
        console.error('Failed to update exercise set notes:', error);
        
        // Rollback: Revert to original state
        setExerciseSets(exercise.exercise_sets || []);
        if (onExerciseUpdate) {
          onExerciseUpdate({
            ...exercise,
            exercise_sets: isAuthenticated ? exercise.exercise_sets : convertToGuestExerciseSets(exercise.exercise_sets)
          });
        }
        
        // TODO: Add toast notification when available
      }
    }
  };

  const deleteSet = async (exerciseId: string | number, setId: string | number) => {
    // Optimistic update: Remove set from local state immediately
    const updatedSets = exerciseSets.filter(set => set.id !== setId);
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated ? updatedSets : convertToGuestExerciseSets(updatedSets)
      });
    }

    if (isAuthenticated) {
      try {
        // Call API to delete the exercise set
        await deleteExerciseSet(setId);
        
        // Optionally invalidate queries to ensure consistency (but UI already updated)
        // queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
      } catch (error) {
        console.error('Failed to delete exercise set:', error);
        
        // Rollback: Revert to original state
        setExerciseSets(exercise.exercise_sets || []);
        if (onExerciseUpdate) {
          onExerciseUpdate({
            ...exercise,
            exercise_sets: isAuthenticated ? exercise.exercise_sets : convertToGuestExerciseSets(exercise.exercise_sets)
          });
        }
        
        // TODO: Add toast notification when available
      }
    }
  };

  const addSet = async (exerciseId: string | number) => {
    const lastSet = exerciseSets[exerciseSets.length - 1];
    
    // Create optimistic new set with temporary ID
    const tempId = `temp-${Date.now()}`;
    const newExerciseSet: ExerciseSet = {
      id: tempId,
      reps: lastSet?.reps || 0,
      intensity: lastSet?.intensity || 0,
      intensity_unit_id: currentIntensityUnit.id,
      exercise_id: exerciseId,
      rest_time_seconds: null,
      done: false,
      notes: null,
      type: exerciseSets.length === 0 ? 'warmup' : 'working',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Optimistic update: Add new set to local state immediately
    const updatedSets = [...exerciseSets, newExerciseSet];
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated ? updatedSets : convertToGuestExerciseSets(updatedSets)
      });
    }

    if (isAuthenticated) {
      try {
        const newSetData: CreateExerciseSetData = {
          reps: lastSet?.reps || 0,
          intensity: lastSet?.intensity || 0,
          intensity_unit_id: currentIntensityUnit.id,
          exercise_id: exerciseId,
          rest_time_seconds: 0, // TODO: Add rest time to the API
          done: false,
          notes: undefined,
          type: exerciseSets.length === 0 ? 'warmup' : 'working'
        };
        
        const createdSet = await createExerciseSet(newSetData);
        
        // Replace the temporary set with the real one from the API
        const finalUpdatedSets = updatedSets.map(set => 
          set.id === tempId ? createdSet : set
        );
        setExerciseSets(finalUpdatedSets);
        
        if (onExerciseUpdate) {
          onExerciseUpdate({
            ...exercise,
            exercise_sets: finalUpdatedSets
          });
        }
      } catch (error) {
        console.error('Failed to create exercise set:', error);
        
        // Rollback: Remove the optimistic set
        setExerciseSets(exercise.exercise_sets || []);
        if (onExerciseUpdate) {
          onExerciseUpdate({
            ...exercise,
            exercise_sets: isAuthenticated ? exercise.exercise_sets : convertToGuestExerciseSets(exercise.exercise_sets)
          });
        }
        
        // TODO: Add toast notification when available
      }
    }
  };

  const handleIntensityUnitChange = (unit: IntensityUnit | GuestIntensityUnit) => {
    setCurrentIntensityUnit(unit);
    setShowExerciseModal(false);
  };

  return (
    <Card key={exercise.id} className="border-input">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                {exercise.exercise_type.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">
                {exercise.exercise_type.name} 
              </h3>
              <Dialog open={exerciseNotesModal} onOpenChange={(open) => {
                setExerciseNotesModal(open);
                if (!open) {
                  setExerciseNotesValue('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700"
                    onClick={() => {
                      setExerciseNotesValue(exercise.notes || '');
                      setExerciseNotesModal(true);
                    }}
                  >
                    <StickyNote className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Exercise Notes</DialogTitle>
                </DialogHeader>
                <Textarea
                  placeholder="Add notes for this exercise..."
                  value={exerciseNotesValue}
                  onChange={(e) => setExerciseNotesValue(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setExerciseNotesModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      updateExerciseNotes(exerciseNotesValue);
                      setExerciseNotesModal(false);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </div>
          <Dialog open={showExerciseModal} onOpenChange={setShowExerciseModal}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exercise Settings</DialogTitle>
              </DialogHeader>
              <ExerciseTypeMore
                currentIntensityUnit={currentIntensityUnit}
                onIntensityUnitChange={handleIntensityUnitChange}
              />
            </DialogContent>
          </Dialog>
        </div>


        {/* Rest Timer */}
        <div className="flex items-center gap-2 mt-2">
          <Timer className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span className="text-sm text-blue-500 dark:text-blue-400">
            Rest Timer: {restTimer.minutes}min {restTimer.seconds}s
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* Sets Table Header */}
        <div className="grid gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2" style={{ gridTemplateColumns: "40px 80px 1fr 40px 32px" }}>
          <div>SET</div>
          <div>{currentIntensityUnit.abbreviation.toUpperCase()}</div>
          <div>REPS</div>
          <div className="text-right">DONE</div>
          <div></div>
        </div>

        {/* Sets */}
        <div className="space-y-2">
          {exerciseSets.map((set, index) => (
            <div
              key={set.id}
              className={`grid gap-4 items-center p-2 rounded ${
                set.done ? "bg-done" : "bg-secondary"
              }`}
              style={{ gridTemplateColumns: "40px 80px 1fr 40px 32px" }}
            >
              <div className="font-medium text-muted-foreground">
                <span>{index + 1}</span>
              </div>
              <div>
                <Input
                  type="number"
                  value={set.intensity || ""}
                  onChange={(e) => updateSet(exercise.id, set.id, "weight", Number.parseInt(e.target.value) || 0)}
                  className="h-8 text-center input"
                  disabled={set.done}
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 bg-transparent border border-input"
                  onClick={() => decrementReps(exercise.id, set.id)}
                  disabled={set.done}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <Input
                  type="number"
                  value={set.reps || ""}
                  onChange={(e) => updateSet(exercise.id, set.id, "reps", Number.parseInt(e.target.value) || 0)}
                  className="h-8 text-center flex-1 min-w-0 input"
                  disabled={set.done}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 bg-transparent border border-input"
                  onClick={() => incrementReps(exercise.id, set.id)}
                  disabled={set.done}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  variant={set.done ? "default" : "outline"}
                  size="sm"
                  className={`h-8 w-8 p-0 ${set.done ? "bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800" : "border border-input dark:border-gray-600"}`}
                  onClick={() => toggleSetCompletion(exercise.id, set.id)}
                >
                  <Check className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex justify-end">
                <Dialog open={moreMenuModal?.setId === set.id} onOpenChange={(open) => {
                  if (!open) {
                    setMoreMenuModal(null);
                    setSetNotesValue('');
                    setInitialSetNotesValue('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700"
                      onClick={() => {
                        const initialNotes = set.notes || '';
                        setMoreMenuModal({ exerciseId: exercise.id, setId: set.id });
                        setSetNotesValue(initialNotes);
                        setInitialSetNotesValue(initialNotes);
                      }}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Set Notes & Options</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Notes for Set {exerciseSets.findIndex(s => s.id === set.id) + 1}
                        </label>
                        <Textarea
                          placeholder="Add notes for this set..."
                          value={setNotesValue}
                          onChange={(e) => {
                            setSetNotesValue(e.target.value);
                          }}
                          className="min-h-[100px]"
                        />
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <Button
                          variant="outline"
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            deleteSet(exercise.id, set.id);
                            setMoreMenuModal(null);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Set
                        </Button>
                        <Button
                          onClick={() => {
                            setMoreMenuModal(null);
                          }}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>

        {/* Add Set Button */}
        <Button variant="outline" className="w-full mt-4 bg-transparent border-input" onClick={() => addSet(exercise.id)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Set
        </Button>
      </CardContent>
    </Card>
  );
};

export default ExerciseRow;