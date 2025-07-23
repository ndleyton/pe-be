import React from 'react';
import { Exercise } from '@/features/exercises/api';
import ExerciseRow from '../ExerciseRow';

interface ExerciseListProps {
  exercises: Exercise[];
  isLoading: boolean;
  error: any;
  workoutId?: string;
}

const ExerciseList: React.FC<ExerciseListProps> = ({ exercises, isLoading, error, workoutId }) => {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Exercises ({exercises.length})
      </h2>
      
      {isLoading && (
        <div className="text-muted-foreground text-center py-4">Loading exercises...</div>
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
            <ExerciseRow key={exercise.id} exercise={exercise} workoutId={workoutId} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExerciseList;