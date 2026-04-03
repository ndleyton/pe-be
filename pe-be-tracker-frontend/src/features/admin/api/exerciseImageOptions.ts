import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";

export interface ExerciseImageOption {
  key: string;
  label: string;
  description: string;
  option_source: "reference_redraw" | "phase_generated";
  images: string[];
  candidate_ids: number[];
  source_images: string[];
  is_current: boolean;
}

export interface ExerciseImageAvailableOption {
  key: string;
  label: string;
  description: string;
  option_source: "reference_redraw" | "phase_generated";
}

export interface ExerciseImageOptionsResponse {
  exercise_type_id: number;
  exercise_name: string;
  current_images: string[];
  reference_images: string[];
  supports_revert_to_reference: boolean;
  available_options: ExerciseImageAvailableOption[];
  options: ExerciseImageOption[];
}

export const getExerciseImageOptions = async (
  exerciseTypeId: string | number,
): Promise<ExerciseImageOptionsResponse> => {
  const response = await api.get(
    endpoints.admin.exerciseTypeReferenceImageOptions(exerciseTypeId),
  );
  return response.data;
};

export const generateExerciseImageOptions = async (
  exerciseTypeId: string | number,
  selection?: { option_key?: string },
): Promise<ExerciseImageOptionsResponse> => {
  const endpoint = endpoints.admin.generateExerciseTypeReferenceImageOptions(
    exerciseTypeId,
  );
  const response =
    selection?.option_key !== undefined
      ? await api.post(endpoint, selection)
      : await api.post(endpoint);
  return response.data;
};

export const applyExerciseImageOption = async (
  exerciseTypeId: string | number,
  selection: { option_key?: string; use_reference?: boolean },
): Promise<ExerciseImageOptionsResponse> => {
  const response = await api.post(
    endpoints.admin.applyExerciseTypeReferenceImageOption(exerciseTypeId),
    selection,
  );
  return response.data;
};
