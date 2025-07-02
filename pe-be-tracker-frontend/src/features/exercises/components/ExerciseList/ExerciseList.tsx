import React from 'react';
import { Exercise } from '@/api/exercises';
import ExerciseRow from '../ExerciseRow';

interface ExerciseListProps {
  exercises: Exercise[];
  isLoading: boolean;
  error: any;
}

const ExerciseList: React.FC<ExerciseListProps> = ({ exercises, isLoading, error }) => {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">
        Exercises ({exercises.length})
      </h2>
      
      {isLoading && (
        <div className="text-gray-400 text-center py-4">Loading exercises...</div>
      )}
      
      {error && (
        <div className="text-red-400 text-center py-4">
          Failed to load exercises
        </div>
      )}
      
      {!isLoading && !error && exercises.length === 0 && (
        <div className="text-muted-foreground text-center py-8 border border-border rounded-lg bg-card">
          No exercises added yet. Use the form above to add your first exercise.
        </div>
      )}
      
      {exercises.length > 0 && (
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <ExerciseRow key={exercise.id} exercise={exercise} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExerciseList;