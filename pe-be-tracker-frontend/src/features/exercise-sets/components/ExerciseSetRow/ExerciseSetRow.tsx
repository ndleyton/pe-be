import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExerciseSet, updateExerciseSet, deleteExerciseSet, UpdateExerciseSetData } from '@/features/exercises/api';
import { useGuestStore, useAuthStore } from '@/stores';

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

  const handleSave = async () => {
    try {
      if (isAuthenticated) {
        const updatedSet = await updateExerciseSet(exerciseSet.id, editData);
        onUpdate(updatedSet);
        
        // Invalidate the exercises query to refresh the cache
        if (workoutId) {
          queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
        }
      } else {
        // Handle guest mode update
        guestActions.updateExerciseSet(exerciseSet.id as string, {
          reps: editData.reps ?? null,
          intensity: editData.intensity ?? null,
          rest_time_seconds: editData.rest_time_seconds ?? null,
          done: editData.done ?? false,
        });
        
        // Create updated set for callback
        const updatedSet: ExerciseSet = {
          ...exerciseSet,
          reps: editData.reps ?? null,
          intensity: editData.intensity ?? null,
          rest_time_seconds: editData.rest_time_seconds ?? null,
          done: editData.done ?? false,
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

  if (isEditing) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 flex items-center space-x-2">
        <input
          type="number"
          placeholder="Reps"
          value={editData.reps || ''}
          onChange={(e) => setEditData({ ...editData, reps: e.target.value ? parseInt(e.target.value) : undefined })}
          className="p-2 bg-background border border-border rounded text-foreground text-sm text-center w-[5ch] min-w-[3ch] max-w-[5ch]"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Weight"
          value={editData.intensity || ''}
          onChange={(e) => setEditData({ ...editData, intensity: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="p-2 bg-background border border-border rounded text-foreground text-sm text-center w-[5ch] min-w-[3ch] max-w-[5ch]"
        />
        <input
          type="number"
          placeholder="Rest (s)"
          value={editData.rest_time_seconds || ''}
          onChange={(e) => setEditData({ ...editData, rest_time_seconds: e.target.value ? parseInt(e.target.value) : undefined })}
          className="w-20 p-2 bg-background border border-border rounded text-foreground text-sm"
        />
        <label className="flex items-center space-x-2 text-foreground text-sm">
          <input
            type="checkbox"
            checked={editData.done}
            onChange={(e) => setEditData({ ...editData, done: e.target.checked })}
            className="text-primary"
          />
          <span>Done</span>
        </label>
        <button
          onClick={handleSave}
          className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
        >
          Save
        </button>
        <button
          onClick={() => setIsEditing(false)}
          className="px-3 py-1 bg-muted text-muted-foreground rounded text-sm hover:bg-accent"
        >
          Cancel
        </button>
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
            <span className="text-muted-foreground">Reps:</span> {exerciseSet.reps || '-'}
          </div>
          <div className="text-foreground">
            <span className="text-muted-foreground">Weight:</span> {exerciseSet.intensity || '-'}
          </div>
          {exerciseSet.rest_time_seconds && (
            <div className="text-foreground">
              <span className="text-muted-foreground">Rest:</span> {exerciseSet.rest_time_seconds}s
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setIsEditing(true)}
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