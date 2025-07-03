import api from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';

// Recipe types to match backend schema
export interface Recipe {
  id: number | string;
  name: string;
  description?: string;
  workout_type_id: number;
  creator_id: number;
  created_at: string;
  updated_at: string;
  exercise_templates: ExerciseTemplate[];
}

export interface ExerciseTemplate {
  id: number | string;
  exercise_type_id: number;
  exercise_type?: {
    id: number;
    name: string;
    description?: string;
    default_intensity_unit: number;
    times_used: number;
  };
  set_templates: SetTemplate[];
}

export interface SetTemplate {
  id: number | string;
  reps?: number;
  intensity?: number;
  intensity_unit_id: number;
  created_at: string;
  updated_at: string;
}

// Request/response data types
export interface CreateRecipeData {
  name: string;
  description?: string;
  workout_type_id: number;
  exercise_templates: CreateExerciseTemplateData[];
}

export interface CreateExerciseTemplateData {
  exercise_type_id: number;
  set_templates: CreateSetTemplateData[];
}

export interface CreateSetTemplateData {
  reps?: number;
  intensity?: number;
  intensity_unit_id: number;
}

export interface UpdateRecipeData {
  name?: string;
  description?: string;
  workout_type_id?: number;
}

// API functions
export const getRecipes = async (): Promise<Recipe[]> => {
  const response = await api.get(endpoints.recipes);
  return response.data;
};

export const getRecipeById = async (recipeId: string | number): Promise<Recipe> => {
  const response = await api.get(endpoints.recipeById(recipeId));
  return response.data;
};

export const createRecipe = async (recipeData: CreateRecipeData): Promise<Recipe> => {
  const response = await api.post(endpoints.recipes, recipeData);
  return response.data;
};

export const updateRecipe = async (recipeId: string | number, updateData: UpdateRecipeData): Promise<Recipe> => {
  const response = await api.put(endpoints.recipeById(recipeId), updateData);
  return response.data;
};

export const deleteRecipe = async (recipeId: string | number): Promise<void> => {
  await api.delete(endpoints.recipeById(recipeId));
};

// Export types
export type { Recipe, ExerciseTemplate, SetTemplate, CreateRecipeData };