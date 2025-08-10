import React from 'react';
import { GuestRecipe } from '@/stores';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

interface RoutineQuickStartCardProps {
  routine: GuestRecipe;
  onStartWorkout: (routine: GuestRecipe) => void;
}

export const RoutineQuickStartCard: React.FC<RoutineQuickStartCardProps> = ({ 
  routine, 
  onStartWorkout
}) => {
  const exerciseCount = routine.exercises.length;
  const totalSets = routine.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">📋</span>
          </div>
          <div>
            <CardTitle className="text-base">{routine.name}</CardTitle>
            <CardDescription>
              {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} • {totalSets} set{totalSets !== 1 ? 's' : ''}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div>
          {routine.exercises.slice(0, 3).map((exercise) => (
            <div key={exercise.id} className="text-sm text-muted-foreground">
              {exercise.exercise_type.name} • {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
            </div>
          ))}
          {routine.exercises.length > 3 && (
            <div className="text-sm text-muted-foreground">
              +{routine.exercises.length - 3} more exercise{routine.exercises.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <Button 
          onClick={() => onStartWorkout(routine)}
          className="w-full mt-2"
          size="sm"
        >
          Start Workout
        </Button>
      </CardContent>
    </Card>
  );
};


