import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGuestStore, useAuthStore, GuestRecipe } from '@/stores';
import { getRecipes, deleteRecipe, Recipe } from '@/features/recipes/api';
import { RecipeCard } from '../RecipeCard/RecipeCard';

interface RecipesSectionProps {
  onStartWorkout: (recipe: GuestRecipe) => void;
}

// Helper function to convert backend Recipe to GuestRecipe format
const convertToGuestRecipe = (recipe: Recipe): GuestRecipe => ({
  id: recipe.id.toString(),
  name: recipe.name,
  description: recipe.description,
  exercises: recipe.exercise_templates.map(template => ({
    id: template.id.toString(),
    exercise_type_id: template.exercise_type_id.toString(),
    exercise_type: template.exercise_type ? {
      id: template.exercise_type.id.toString(),
      name: template.exercise_type.name,
      description: template.exercise_type.description || '',
      default_intensity_unit: template.exercise_type.default_intensity_unit,
      times_used: template.exercise_type.times_used,
    } : {
      id: template.exercise_type_id.toString(),
      name: 'Unknown Exercise',
      description: '',
      default_intensity_unit: 1,
      times_used: 0,
    },
    sets: template.set_templates.map(setTemplate => ({
      id: setTemplate.id.toString(),
      reps: setTemplate.reps ?? null,
      intensity: setTemplate.intensity ?? null,
      intensity_unit_id: setTemplate.intensity_unit_id,
      rest_time_seconds: null,
    })),
    notes: null,
  })),
  created_at: recipe.created_at,
  updated_at: recipe.updated_at,
});

export const RecipesSection: React.FC<RecipesSectionProps> = ({ onStartWorkout }) => {
  // Get state from stores
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();
  const queryClient = useQueryClient();

  // Fetch recipes from backend for authenticated users
  const { data: serverRecipes = [], isLoading, error } = useQuery({
    queryKey: ['routines'],
    queryFn: getRecipes,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Use backend data for authenticated users, guest data for guests
  const recipes: GuestRecipe[] = isAuthenticated 
    ? (Array.isArray(serverRecipes) ? serverRecipes.map(convertToGuestRecipe) : [])
    : (Array.isArray(guestData.recipes) ? guestData.recipes : []);

  // Handle recipe deletion
  const handleDeleteRecipe = async (recipeId: string) => {
    if (isAuthenticated) {
      try {
        await deleteRecipe(recipeId);
        // Invalidate recipes query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['routines'] });
      } catch (error) {
        console.error('Error deleting recipe:', error);
      }
    } else {
      // Use guest actions for guest users
      guestActions.deleteRecipe(recipeId);
    }
  };

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Quick Start Routines</h2>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (recipes.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Quick Start Routines</h2>
        <span className="text-sm text-muted-foreground">
          {recipes.length} routine{recipes.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onStartWorkout={onStartWorkout}
            onDelete={handleDeleteRecipe}
          />
        ))}
      </div>
    </div>
  );
};