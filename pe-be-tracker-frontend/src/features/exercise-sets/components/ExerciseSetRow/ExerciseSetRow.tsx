import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExerciseSet, updateExerciseSet, deleteExerciseSet, UpdateExerciseSetData } from '@/features/exercises/api';
import { useGuestStore, useAuthStore } from '@/stores';
import { Input } from '@/shared/components/ui/input';
import { formatDecimal, parseDecimalInput } from '@/utils/format';

interface ExerciseSetRowProps {
  exerciseSet: ExerciseSet;
  onUpdate: (updatedSet: ExerciseSet) => void;
  onDelete: (setId: number | string) => void;
  workoutId?: string;
}

const ExerciseSetRow: React.FC<ExerciseSetRowProps> = ({ exerciseSet, onUpdate, onDelete, workoutId }) => {
  // Get state from stores
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const guestActions = useGuestStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<UpdateExerciseSetData>({
    reps: exerciseSet.reps || undefined,
    intensity: exerciseSet.intensity || undefined,
    rest_time_seconds: exerciseSet.rest_time_seconds || undefined,
    done: exerciseSet.done,
  });
  
  // Local string states for inputs to allow intermediate values (e.g., "1.")
  const [repsInput, setRepsInput] = useState<string>('');
  const [intensityInput, setIntensityInput] = useState<string>('');
  const [restInput, setRestInput] = useState<string>('');

  const handleSave = async () => {
    try {
      // Parse string inputs into numbers or undefined
      const parseOptionalInt = (s: string): number | undefined => {
        const t = s.trim();
        if (t === '') return undefined;
        const n = parseInt(t, 10);
        return Number.isNaN(n) ? undefined : n;
      };

      const reps = parseOptionalInt(repsInput);
      const intensity = parseDecimalInput(intensityInput);
      const rest_time_seconds = parseOptionalInt(restInput);

      const updateData: UpdateExerciseSetData = {
        reps,
        intensity,
        rest_time_seconds,
        done: editData.done ?? false,
      };

      if (isAuthenticated) {
        const updatedSet = await updateExerciseSet(exerciseSet.id, updateData);
        onUpdate(updatedSet);
        
        // Invalidate the exercises query to refresh the cache
        if (workoutId) {
          queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
        }
      } else {
        // Handle guest mode update
        guestActions.updateExerciseSet(exerciseSet.id as string, {
          reps: reps ?? null,
          intensity: intensity ?? null,
          rest_time_seconds: rest_time_seconds ?? null,
          done: updateData.done ?? false,
        });
        
        // Create updated set for callback
        const updatedSet: ExerciseSet = {
          ...exerciseSet,
          reps: reps ?? null,
          intensity: intensity ?? null,
          rest_time_seconds: rest_time_seconds ?? null,
          done: updateData.done ?? false,
          updated_at: new Date().toISOString(),
        };
        onUpdate(updatedSet);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating exercise set:', error);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this set?')) {
      try {
        if (isAuthenticated) {
          await deleteExerciseSet(exerciseSet.id);
          
          if (workoutId) {
            queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
          }
        } else {
          // Handle guest mode delete
          guestActions.deleteExerciseSet(exerciseSet.id as string);
        }
        onDelete(exerciseSet.id);
      } catch (error) {
        console.error('Error deleting exercise set:', error);
      }
    }
  };

  const toggleDone = async () => {
    try {
      if (isAuthenticated) {
        const updatedSet = await updateExerciseSet(exerciseSet.id, { done: !exerciseSet.done });
        onUpdate(updatedSet);
        
        if (workoutId) {
          queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
        }
      } else {
        // Handle guest mode toggle
        guestActions.updateExerciseSet(exerciseSet.id as string, {
          done: !exerciseSet.done,
        });
        
        // Create updated set for callback
        const updatedSet: ExerciseSet = {
          ...exerciseSet,
          done: !exerciseSet.done,
          updated_at: new Date().toISOString(),
        };
        onUpdate(updatedSet);
      }
    } catch (error) {
      console.error('Error toggling done status:', error);
    }
  };
  
  // Initialize input strings and enter edit mode
  const openEdit = () => {
    setRepsInput(
      exerciseSet.reps !== null && exerciseSet.reps !== undefined ? String(exerciseSet.reps) : ''
    );
    setIntensityInput(
      exerciseSet.intensity !== null && exerciseSet.intensity !== undefined ? String(exerciseSet.intensity) : ''
    );
    setRestInput(
      exerciseSet.rest_time_seconds !== null && exerciseSet.rest_time_seconds !== undefined ? String(exerciseSet.rest_time_seconds) : ''
    );
    setEditData((prev) => ({ ...prev, done: exerciseSet.done }));
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap sm:flex-nowrap items-center gap-2">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="Reps"
          value={repsInput}
          onChange={(e) => setRepsInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') handleSave();
          }}
          className="text-center w-16 sm:w-[5ch] flex-shrink-0"
        />
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Weight"
          value={intensityInput}
          onChange={(e) => setIntensityInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') handleSave();
          }}
          className="text-center w-16 sm:w-[5ch] flex-shrink-0"
        />
        <Input
          type="text"
          inputMode="numeric"
          placeholder="Rest (s)"
          value={restInput}
          onChange={(e) => setRestInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') handleSave();
          }}
          className="w-20 sm:w-20 flex-shrink-0"
        />
        <label className="flex items-center space-x-2 text-foreground text-sm flex-shrink-0">
          <input
            type="checkbox"
            checked={editData.done}
            onChange={(e) => setEditData({ ...editData, done: e.target.checked })}
            className="text-primary"
          />
          <span className="hidden sm:inline">Done</span>
          <span className="sm:hidden">✓</span>
        </label>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 flex-1 sm:flex-initial"
          >
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-2 bg-muted text-muted-foreground rounded text-sm hover:bg-accent flex-1 sm:flex-initial"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 flex items-center justify-between ${
      exerciseSet.done ? 'bg-secondary/20 border-secondary' : 'bg-card border-border'
    }`}>
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleDone}
          aria-label={exerciseSet.done ? "Mark as incomplete" : "Mark as complete"}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            exerciseSet.done
              ? 'bg-secondary border-secondary text-secondary-foreground'
              : 'border-border hover:border-primary'
          }`}
        >
          {exerciseSet.done && '✓'}
        </button>
        <div className="flex space-x-6 text-sm">
          <div className="text-foreground">
            <span className="text-muted-foreground">Reps:</span> {exerciseSet.reps ?? '-'}
          </div>
          <div className="text-foreground">
            <span className="text-muted-foreground">Weight:</span> {formatDecimal(exerciseSet.intensity)}
          </div>
          {exerciseSet.rest_time_seconds != null && (
            <div className="text-foreground">
              <span className="text-muted-foreground">Rest:</span> {exerciseSet.rest_time_seconds}s
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={openEdit}
          className="text-primary hover:text-primary/80 text-sm"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          className="text-destructive hover:text-destructive/80 text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default ExerciseSetRow;