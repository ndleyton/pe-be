import type { ExerciseSet, UpdateExerciseSetData } from "@/features/exercises/api";
import { getExerciseSetClientKey } from "./exerciseRow";

export type SetDirtyField = "intensity" | "reps" | "duration_seconds";
export type SetField = "weight" | "reps" | "duration_seconds";

export interface SetWriteState {
  serverSetId: string | number;
  pendingPatch: UpdateExerciseSetData | null;
  pendingTimer: ReturnType<typeof setTimeout> | null;
  inFlightPatch: UpdateExerciseSetData | null;
  isInFlight: boolean;
  dirtyFields: Set<SetDirtyField>;
}

export const createInitialWriteState = (
  serverSetId: string | number,
): SetWriteState => ({
  serverSetId,
  pendingPatch: null,
  pendingTimer: null,
  inFlightPatch: null,
  isInFlight: false,
  dirtyFields: new Set<SetDirtyField>(),
});

export const mergeUpdateData = (
  base: UpdateExerciseSetData | null,
  override: UpdateExerciseSetData | null,
): UpdateExerciseSetData | null => {
  if (!base && !override) return null;
  if (!base) return override;
  if (!override) return base;
  return {
    ...base,
    ...override,
  };
};

/**
 * Reconciles incoming server/cache exercise sets with current local exercise sets.
 * If a set has dirty fields (pending or in-flight save), local values for those dirty
 * fields are preserved while clean fields (or non-dirty sets) accept the incoming updates.
 */
export const reconcileExerciseSets = (
  currentLocalSets: ExerciseSet[],
  incomingSets: ExerciseSet[],
  writeStates: Map<string, SetWriteState>,
): ExerciseSet[] => {
  const localSetsByKey = new Map<string, ExerciseSet>();
  currentLocalSets.forEach((set) => {
    localSetsByKey.set(getExerciseSetClientKey(set), set);
  });

  return incomingSets.map((incomingSet) => {
    const key = getExerciseSetClientKey(incomingSet);
    const localSet = localSetsByKey.get(key);
    const writeState = writeStates.get(key);

    if (!localSet || !writeState || writeState.dirtyFields.size === 0) {
      return incomingSet;
    }

    // Preserve dirty fields from localSet, take clean fields from incomingSet
    const reconciledSet: ExerciseSet = {
      ...incomingSet,
      client_key: localSet.client_key ?? incomingSet.client_key,
    };

    if (writeState.dirtyFields.has("reps")) {
      reconciledSet.reps = localSet.reps;
    }
    if (writeState.dirtyFields.has("duration_seconds")) {
      reconciledSet.duration_seconds = localSet.duration_seconds;
    }
    if (writeState.dirtyFields.has("intensity")) {
      reconciledSet.intensity = localSet.intensity;
      reconciledSet.intensity_unit_id = localSet.intensity_unit_id;
    }

    return reconciledSet;
  });
};
