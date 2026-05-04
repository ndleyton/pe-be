import api from "@/shared/api/client";
import { config } from "@/app/config/env";
import { endpoints } from "@/shared/api/endpoints";
import { resolveApiAssetUrl } from "@/shared/api/assets";

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

const baseApiTimeout = Number.isFinite(config.apiTimeout) ? config.apiTimeout : 10000;
const IMAGE_GENERATION_TIMEOUT_MS = Math.max(baseApiTimeout, 90000);

const normalizeImageOptionsResponse = (
  response: ExerciseImageOptionsResponse,
): ExerciseImageOptionsResponse => ({
  ...response,
  current_images: response.current_images.map(resolveApiAssetUrl),
  reference_images: response.reference_images.map(resolveApiAssetUrl),
  options: response.options.map((option) => ({
    ...option,
    images: option.images.map(resolveApiAssetUrl),
    source_images: option.source_images.map(resolveApiAssetUrl),
  })),
});

export const getExerciseImageOptions = async (
  exerciseTypeId: string | number,
): Promise<ExerciseImageOptionsResponse> => {
  const response = await api.get(
    endpoints.admin.exerciseTypeReferenceImageOptions(exerciseTypeId),
  );
  return normalizeImageOptionsResponse(response.data);
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
      ? await api.post(endpoint, selection, {
          timeout: IMAGE_GENERATION_TIMEOUT_MS,
        })
      : await api.post(endpoint, undefined, {
          timeout: IMAGE_GENERATION_TIMEOUT_MS,
        });
  return normalizeImageOptionsResponse(response.data);
};

export const applyExerciseImageOption = async (
  exerciseTypeId: string | number,
  selection: { option_key?: string; use_reference?: boolean },
): Promise<ExerciseImageOptionsResponse> => {
  const response = await api.post(
    endpoints.admin.applyExerciseTypeReferenceImageOption(exerciseTypeId),
    selection,
  );
  return normalizeImageOptionsResponse(response.data);
};
