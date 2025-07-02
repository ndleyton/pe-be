import React from 'react';
import { useGuestData, GuestRecipe } from '@/contexts/GuestDataContext';
import { RecipeCard } from '../RecipeCard/RecipeCard';

interface RecipesSectionProps {
  onStartWorkout: (recipe: GuestRecipe) => void;
}

export const RecipesSection: React.FC<RecipesSectionProps> = ({ onStartWorkout }) => {
  const { data: guestData, actions: guestActions } = useGuestData();
  const recipes = guestData.recipes || [];

  if (recipes.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Quick Start Recipes</h2>
        <span className="text-sm text-muted-foreground">
          {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onStartWorkout={onStartWorkout}
            onDelete={guestActions.deleteRecipe}
          />
        ))}
      </div>
    </div>
  );
};