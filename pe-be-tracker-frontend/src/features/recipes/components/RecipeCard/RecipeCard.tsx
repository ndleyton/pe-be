import React from 'react';
import { GuestRecipe } from '@/stores';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RecipeCardProps {
  recipe: GuestRecipe;
  onStartWorkout: (recipe: GuestRecipe) => void;
  onDelete?: (recipeId: string) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ 
  recipe, 
  onStartWorkout, 
  onDelete 
}) => {
  const exerciseCount = recipe.exercises.length;
  const totalSets = recipe.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">📋</span>
            </div>
            <div>
              <CardTitle className="text-base">{recipe.name}</CardTitle>
              <CardDescription>
                {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} • {totalSets} set{totalSets !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(recipe.id);
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              ×
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {recipe.exercises.slice(0, 3).map((exercise, index) => (
            <div key={exercise.id} className="text-sm text-muted-foreground">
              {exercise.exercise_type.name} • {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
            </div>
          ))}
          {recipe.exercises.length > 3 && (
            <div className="text-sm text-muted-foreground">
              +{recipe.exercises.length - 3} more exercise{recipe.exercises.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <Button 
          onClick={() => onStartWorkout(recipe)}
          className="w-full mt-4"
          size="sm"
        >
          Start Workout
        </Button>
      </CardContent>
    </Card>
  );
};