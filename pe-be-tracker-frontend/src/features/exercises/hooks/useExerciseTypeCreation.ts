import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import {
  createExerciseType,
  getExerciseTypes,
  type CreateExerciseTypeData,
  type ExerciseType,
} from "@/features/exercises/api";
import {
  getDefaultExerciseTypeUnit,
  normalizeExerciseTypeName,
} from "@/features/exercises/lib/exerciseTypes";

type NamedExerciseType = {
  id: string | number;
  name: string;
};

type UseExerciseTypeCreationArgs<T extends NamedExerciseType> = {
  searchTerm: string;
  deferredSearchTerm: string;
  exerciseTypes: T[];
  isSearchingWithoutResults: boolean;
  isAuthenticated: boolean;
  lookupLimit: number;
  onResolvedExerciseType: (exerciseType: T | ExerciseType) => void;
  createGuestExerciseType?: (
    payload: CreateExerciseTypeData,
  ) => T | undefined;
};

export const useExerciseTypeCreation = <T extends NamedExerciseType>({
  searchTerm,
  deferredSearchTerm,
  exerciseTypes,
  isSearchingWithoutResults,
  isAuthenticated,
  lookupLimit,
  onResolvedExerciseType,
  createGuestExerciseType,
}: UseExerciseTypeCreationArgs<T>) => {
  const queryClient = useQueryClient();
  const createInFlight = useRef(false);
  const trimmedSearchTerm = searchTerm.trim();
  const trimmedDeferredSearchTerm = deferredSearchTerm.trim();
  const isSearchSettled =
    trimmedSearchTerm.length === 0 ||
    trimmedSearchTerm === trimmedDeferredSearchTerm;
  const canCreate = isAuthenticated || createGuestExerciseType !== undefined;

  const exactExerciseTypeMatch = useMemo(
    () =>
      trimmedSearchTerm
        ? exerciseTypes.find(
            (exerciseType) =>
              normalizeExerciseTypeName(exerciseType.name) ===
              normalizeExerciseTypeName(trimmedSearchTerm),
          )
        : undefined,
    [exerciseTypes, trimmedSearchTerm],
  );

  const showCreateButton =
    canCreate &&
    trimmedSearchTerm.length > 0 &&
    isSearchSettled &&
    !exactExerciseTypeMatch &&
    !isSearchingWithoutResults;

  const findExactExerciseTypeMatch = useCallback(
    async (name: string) => {
      const normalizedName = normalizeExerciseTypeName(name);
      const existingInResults = exerciseTypes.find(
        (exerciseType) =>
          normalizeExerciseTypeName(exerciseType.name) === normalizedName,
      );
      if (existingInResults) {
        return existingInResults;
      }

      if (!isAuthenticated) {
        return undefined;
      }

      const response = await getExerciseTypes(
        "name",
        undefined,
        lookupLimit,
        undefined,
        name,
      );
      return response.data.find(
        (exerciseType) =>
          normalizeExerciseTypeName(exerciseType.name) === normalizedName,
      );
    },
    [exerciseTypes, isAuthenticated, lookupLimit],
  );

  const createMutation = useMutation({
    mutationFn: createExerciseType,
    onSuccess: (newExerciseType) => {
      queryClient.invalidateQueries({ queryKey: ["exerciseTypes"] });
      onResolvedExerciseType(newExerciseType);
    },
    onError: (err: unknown) => {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 400 &&
        typeof err.response.data?.detail === "string" &&
        err.response.data.detail.toLowerCase().includes("already exists")
      ) {
        void findExactExerciseTypeMatch(searchTerm).then((existing) => {
          if (existing) {
            onResolvedExerciseType(existing);
          }
        });
      }
    },
  });

  const handleCreateExerciseType = useCallback(() => {
    if (createInFlight.current) return;
    if (!trimmedSearchTerm) return;

    if (exactExerciseTypeMatch) {
      onResolvedExerciseType(exactExerciseTypeMatch);
      return;
    }

    createInFlight.current = true;

    const payload: CreateExerciseTypeData = {
      name: trimmedSearchTerm,
      description: "Custom exercise",
      default_intensity_unit: getDefaultExerciseTypeUnit(trimmedSearchTerm),
    };

    if (isAuthenticated) {
      createMutation.mutate(payload, {
        onSettled: () => {
          createInFlight.current = false;
        },
      });
      return;
    }

    const createdExerciseType = createGuestExerciseType?.(payload);
    if (createdExerciseType) {
      onResolvedExerciseType(createdExerciseType);
    }
    createInFlight.current = false;
  }, [
    createGuestExerciseType,
    createMutation,
    exactExerciseTypeMatch,
    isAuthenticated,
    onResolvedExerciseType,
    trimmedSearchTerm,
  ]);

  return {
    trimmedSearchTerm,
    exactExerciseTypeMatch,
    showCreateButton,
    createMutation,
    handleCreateExerciseType,
  };
};
