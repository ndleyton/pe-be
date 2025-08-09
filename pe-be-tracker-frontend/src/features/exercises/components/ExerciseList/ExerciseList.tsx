import React from 'react';
import { Exercise } from '@/features/exercises/api';
import ExerciseRow from '../ExerciseRow';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface ExerciseListProps {
  exercises: Exercise[];
  isLoading: boolean;
  error: any;
  workoutId?: string;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
}

const ExerciseList: React.FC<ExerciseListProps> = ({ exercises, isLoading, error, workoutId, onExerciseUpdate }) => {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Exercises: {exercises.length}
      </h2>
      
      {isLoading && (
        <>
          <div className="text-muted-foreground text-center py-2">Loading exercises...</div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-center space-x-4">
                  <Skeleton className="w-8 h-8 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      
      {error && (
        <div className="text-destructive text-center py-4">
          Failed to load exercises
        </div>
      )}
      
      {!isLoading && !error && exercises.length === 0 && (
        <div className="text-muted-foreground text-center py-8 border border-border rounded-lg bg-card">
          No exercises added yet. Use the form above to add your first exercise.
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