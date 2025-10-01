import React from 'react';
import { Exercise } from '@/features/exercises/api';
import ExerciseRow from '../ExerciseRow';
import { ExerciseListSkeleton } from '@/shared/components/skeletons/ExerciseListSkeleton';

interface ExerciseListProps {
  exercises: Exercise[];
  status: 'idle' | 'pending' | 'success' | 'error';
  workoutId?: string;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
}

const ExerciseList: React.FC<ExerciseListProps> = ({ exercises, status, workoutId, onExerciseUpdate }) => {
  return (
    <div className="mt-8">
      {status === 'pending' && <ExerciseListSkeleton />}
      
      {status === 'error' && (
        <div className="text-destructive text-center py-4">
          Failed to load exercises
        </div>
      )}
      
      {status === 'success' && exercises.length === 0 && (
        <div className="text-muted-foreground text-center p-4 border border-border rounded-lg bg-card">
          No exercises added yet. Click below to add your first exercise.
        </div>
      )}
      
      {exercises.length > 0 && (
        <div className="space-y-4">
          {exercises.map((exercise) => (
            <ExerciseRow key={exercise.id} exercise={exercise} workoutId={workoutId} onExerciseUpdate={onExerciseUpdate} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExerciseList;
