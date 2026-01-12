import { memo, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Exercise,
  ExerciseSet,
  IntensityUnit,
  updateExerciseSet,
  createExerciseSet,
  deleteExerciseSet,
  deleteExercise,
  CreateExerciseSetData,
  UpdateExerciseSetData,
} from "@/features/exercises/api";
import { GuestExerciseSet, useGuestStore } from "@/stores";
import { useAuthStore } from "@/stores";
import { ExerciseTypeMore } from "@/features/exercises/components/ExerciseTypeMore";
import {
  Button,
  Input,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@/shared/components/ui";
import {
  MoreVertical,
  StickyNote,
  Plus,
  Minus,
  Check,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useDebounce } from "@/shared/hooks";
import { formatDecimal, parseDecimalInput } from "@/utils/format";
import { Link } from "react-router-dom";

// Guest intensity unit type (simplified)
interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

interface ExerciseRowProps {
  exercise: Exercise;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
  onExerciseDelete?: (exerciseId: number | string) => void;
  workoutId?: string;
}

interface MoreMenuModalState {
  exerciseId: string | number;
  setId: string | number;
}

const formatIntensityInputValue = (value: ExerciseSet["intensity"]): string => {
  const formatted = formatDecimal(value);
  return formatted === "-" ? "" : formatted;
};

const buildIntensityInputs = (sets: ExerciseSet[]): Record<string, string> => {
  return sets.reduce<Record<string, string>>((acc, set) => {
    acc[String(set.id)] = formatIntensityInputValue(set.intensity);
    return acc;
  }, {});
};

const buildRepsInputs = (sets: ExerciseSet[]): Record<string, string> => {
  return sets.reduce<Record<string, string>>((acc, set) => {
    acc[String(set.id)] = set.reps === null || set.reps === undefined ? "" : String(set.reps);
    return acc;
  }, {});
};

const ExerciseRow: React.FC<ExerciseRowProps> = ({
  exercise,
  onExerciseUpdate,
  onExerciseDelete,
  workoutId,
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestDeleteExercise = useGuestStore((state) => state.deleteExercise);
  const queryClient = useQueryClient();
  const isUnsavedExercise =
    isAuthenticated &&
    typeof exercise.id === "string" &&
    exercise.id.startsWith("optimistic-");

  // Local state for sets
  const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>(
    exercise.exercise_sets || [],
  );

  // Sync local state when props change (handling external re-fetches/invalidations)
  useEffect(() => {
    setExerciseSets(exercise.exercise_sets || []);
  }, [exercise.exercise_sets]);

  const [intensityInputs, setIntensityInputs] = useState<
    Record<string, string>
  >(() => buildIntensityInputs(exercise.exercise_sets || []));

  const [repsInputs, setRepsInputs] = useState<Record<string, string>>(() =>
    buildRepsInputs(exercise.exercise_sets || [])
  );

  // Sync inputs when exerciseSets change
  useEffect(() => {
    setIntensityInputs(buildIntensityInputs(exerciseSets));
    setRepsInputs(buildRepsInputs(exerciseSets));
  }, [exerciseSets]);

  const [exerciseNotesModal, setExerciseNotesModal] = useState(false);
  const [exerciseNotesValue, setExerciseNotesValue] = useState<string>("");
  // Notes are edited via moreMenuModal
  const [setNotesValue, setSetNotesValue] = useState<string>("");
  const debouncedSetNotesValue = useDebounce(setNotesValue, 1000); // 1 second delay for set notes
  const [initialSetNotesValue, setInitialSetNotesValue] = useState<string>("");
  const [moreMenuModal, setMoreMenuModal] = useState<MoreMenuModalState | null>(
    null,
  );
  // const [restTimer] = useState<RestTimer>({ minutes: 2, seconds: 30 });
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  // Default intensity unit
  const [currentIntensityUnit, setCurrentIntensityUnit] = useState<
    IntensityUnit | GuestIntensityUnit
  >({
    id: 1,
    name: "Kilograms",
    abbreviation: "kg",
  });

  // Debounce refs for API calls (keyed by setId)
  const pendingUpdatesRef = useRef<Record<string, { timeout: ReturnType<typeof setTimeout>, data: UpdateExerciseSetData }>>({});

  // Flush pending updates on unmount
  useEffect(() => {
    return () => {
      Object.keys(pendingUpdatesRef.current).forEach((key) => {
        const update = pendingUpdatesRef.current[key];
        clearTimeout(update.timeout);
        // Fire and forget immediate update
        updateExerciseSet(key, update.data).catch((err) =>
          console.error("Failed to flush update on unmount:", err)
        );
      });
    };
  }, []);

  const updateExerciseNotes = (notes: string) => {
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        notes: notes,
      });
    }
  };

  useEffect(() => {
    if (moreMenuModal && debouncedSetNotesValue !== initialSetNotesValue) {
      // Find the current set to check if notes actually changed
      const currentSet = exerciseSets.find(
        (set) => String(set.id) === String(moreMenuModal.setId),
      );
      if (currentSet && debouncedSetNotesValue !== (currentSet.notes || "")) {
        updateSetNotes(moreMenuModal.setId, debouncedSetNotesValue);
      }
    }
  }, [
    debouncedSetNotesValue,
    moreMenuModal,
    exerciseSets,
    initialSetNotesValue,
  ]);

  const convertToGuestExerciseSets = (
    sets: ExerciseSet[],
  ): GuestExerciseSet[] => {
    return sets.map((set) => ({
      ...set,
      id: String(set.id),
      exercise_id: String(set.exercise_id),
    }));
  };

  // Debounced API call execution
  const debouncedSaveSet = (setId: string | number, data: UpdateExerciseSetData) => {
    const key = String(setId);

    // Clear existing timeout
    if (pendingUpdatesRef.current[key]) {
      clearTimeout(pendingUpdatesRef.current[key].timeout);
      // Merge new data with pending data to ensure nothing is lost
      pendingUpdatesRef.current[key].data = {
        ...pendingUpdatesRef.current[key].data,
        ...data
      };
    } else {
      pendingUpdatesRef.current[key] = {
        timeout: setTimeout(() => { }, 0), // Placeholder
        data: data
      };
    }

    // Set new timeout
    pendingUpdatesRef.current[key].timeout = setTimeout(async () => {
      try {
        const finalData = pendingUpdatesRef.current[key].data;
        await updateExerciseSet(setId, finalData);
      } catch (error) {
        console.error("Failed to update exercise set:", error);
        // On error, invalidate queries so the UI eventually syncs to the server state.
        // We DO NOT rollback manually to avoid janky UX and race conditions.
        // The invalidation will trigger a prop update, which the useEffectSync logic handles.
        if (workoutId) {
          queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
        }
      } finally {
        delete pendingUpdatesRef.current[key];
      }
    }, 500); // 500ms debounce
  };

  const updateSet = (
    setId: string | number,
    field: "weight" | "reps",
    value: number | null,
  ) => {
    // 1. Optimistic Update (Local State)
    const updatedSets = exerciseSets.map((set) => {
      if (String(set.id) === String(setId)) {
        return {
          ...set,
          [field === "weight" ? "intensity" : "reps"]: value,
        };
      }
      return set;
    });
    setExerciseSets(updatedSets);

    // Notify parent to keep UI consistent (totals, headers etc)
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated
          ? updatedSets
          : convertToGuestExerciseSets(updatedSets),
      });
    }

    // 2. Persist
    if (isAuthenticated) {
      const updateData: UpdateExerciseSetData = {};
      if (field === "weight") {
        updateData.intensity = value;
      } else {
        updateData.reps = value;
      }

      debouncedSaveSet(setId, updateData);
    } else {
      // Guest mode: relies on parent's onExerciseUpdate or separate guest stores
      // Current architecture implies onExerciseUpdate handles guest persistence in parent,
      // or we might need to verify if ExerciseRow needs to call guestActions.
      // Looking at previous code, guest updates were handled via onExerciseUpdate -> parent.
    }
  };

  const incrementReps = (setId: string | number) => {
    const currentSet = exerciseSets.find((s) => String(s.id) === String(setId));
    const newReps = (currentSet?.reps || 0) + 1;
    updateSet(setId, "reps", newReps);
  };

  const decrementReps = (setId: string | number) => {
    const currentSet = exerciseSets.find((s) => String(s.id) === String(setId));
    const newReps = Math.max((currentSet?.reps || 0) - 1, 0);
    updateSet(setId, "reps", newReps);
  };

  const toggleSetCompletion = async (setId: string | number) => {
    const currentSet = exerciseSets.find(
      (set) => String(set.id) === String(setId),
    );
    if (!currentSet) return;

    // Optimistic update
    const updatedSets = exerciseSets.map((set) => {
      if (String(set.id) === String(setId)) {
        return {
          ...set,
          done: !set.done,
        };
      }
      return set;
    });
    setExerciseSets(updatedSets);

    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated
          ? updatedSets
          : convertToGuestExerciseSets(updatedSets),
      });
    }

    if (isAuthenticated) {
      try {
        const updateData: UpdateExerciseSetData = {
          done: !currentSet.done,
        };
        await updateExerciseSet(setId, updateData);
      } catch (error) {
        console.error("Failed to toggle exercise set completion:", error);
        if (workoutId) {
          queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
        }
      }
    }
  };

  const updateSetNotes = async (setId: string | number, notes: string) => {
    // Optimistic update
    const updatedSets = exerciseSets.map((set) => {
      if (String(set.id) === String(setId)) {
        return {
          ...set,
          notes: notes,
        };
      }
      return set;
    });
    setExerciseSets(updatedSets);

    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated
          ? updatedSets
          : convertToGuestExerciseSets(updatedSets),
      });
    }

    if (isAuthenticated) {
      try {
        const updateData: UpdateExerciseSetData = {
          notes: notes,
        };
        await updateExerciseSet(setId, updateData);
      } catch (error) {
        console.error("Failed to update exercise set notes:", error);
        if (workoutId) {
          queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
        }
      }
    }
  };

  const deleteSet = async (setId: string | number) => {
    const updatedSets = exerciseSets.filter(
      (set) => String(set.id) !== String(setId),
    );
    setExerciseSets(updatedSets);
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated
          ? updatedSets
          : convertToGuestExerciseSets(updatedSets),
      });
    }

    if (isAuthenticated) {
      try {
        await deleteExerciseSet(setId);
      } catch (error) {
        console.error("Failed to delete exercise set:", error);
        if (workoutId) {
          queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
        }
      }
    }
  };

  const addSet = async (exerciseId: string | number) => {
    if (isUnsavedExercise) return;

    const lastSet = exerciseSets[exerciseSets.length - 1];

    // Create optimistic new set with temporary ID
    const tempId = `temp-${Date.now()}`;
    const newExerciseSet: ExerciseSet = {
      id: tempId,
      reps: lastSet?.reps,
      intensity: lastSet?.intensity,
      intensity_unit_id: currentIntensityUnit.id,
      exercise_id: exerciseId,
      rest_time_seconds: null,
      done: false,
      notes: null,
      type: exerciseSets.length === 0 ? "warmup" : "working",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistic update
    const updatedSets = [...exerciseSets, newExerciseSet];
    setExerciseSets(updatedSets);

    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: isAuthenticated
          ? updatedSets
          : convertToGuestExerciseSets(updatedSets),
      });
    }

    if (isAuthenticated) {
      try {
        const newSetData: CreateExerciseSetData = {
          reps: lastSet?.reps || 0,
          intensity: lastSet?.intensity || 0,
          intensity_unit_id: currentIntensityUnit.id,
          exercise_id: exerciseId,
          rest_time_seconds: 0,
          done: false,
          notes: undefined,
          type: exerciseSets.length === 0 ? "warmup" : "working",
        };

        const createdSet = await createExerciseSet(newSetData);

        // Replace the temporary set with the real one
        const finalUpdatedSets = updatedSets.map((set) =>
          String(set.id) === String(tempId) ? createdSet : set,
        );
        setExerciseSets(finalUpdatedSets);

        if (onExerciseUpdate) {
          onExerciseUpdate({
            ...exercise,
            exercise_sets: finalUpdatedSets,
          });
        }
      } catch (error) {
        console.error("Failed to create exercise set:", error);
        if (workoutId) {
          queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
        }
      }
    }
  };

  const handleIntensityUnitChange = (
    unit: IntensityUnit | GuestIntensityUnit,
  ) => {
    setCurrentIntensityUnit(unit);
    setShowExerciseModal(false);
  };

  const handleExerciseDelete = async () => {
    if (isUnsavedExercise) return;

    try {
      if (isAuthenticated) {
        await deleteExercise(exercise.id);
        if (onExerciseDelete) {
          onExerciseDelete(exercise.id);
        }
      } else {
        guestDeleteExercise(exercise.id.toString());
        if (onExerciseDelete) {
          onExerciseDelete(exercise.id);
        }
      }
      setShowExerciseModal(false);
    } catch (error) {
      console.error("Error deleting exercise:", error);
    }
  };

  return (
    <div key={exercise.id} className="py-4 text-left">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <span className="text-primary-foreground text-sm font-bold">
              {exercise.exercise_type.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-foreground font-semibold">
              {exercise.exercise_type.name}
            </h3>
            <Dialog
              open={exerciseNotesModal}
              onOpenChange={(open) => {
                setExerciseNotesModal(open);
                if (!open) {
                  setExerciseNotesValue("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-accent hover:text-accent-foreground h-6 w-6 p-0 dark:hover:bg-gray-700"
                  onClick={() => {
                    setExerciseNotesValue(exercise.notes || "");
                    setExerciseNotesModal(true);
                  }}
                >
                  <StickyNote className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Exercise Notes</DialogTitle>
                </DialogHeader>
                <Textarea
                  placeholder="Add notes for this exercise..."
                  value={exerciseNotesValue}
                  onChange={(e) => setExerciseNotesValue(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setExerciseNotesModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      updateExerciseNotes(exerciseNotesValue);
                      setExerciseNotesModal(false);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-accent hover:text-accent-foreground h-6 w-6 p-0 dark:hover:bg-gray-700"
              asChild
            >
              <Link
                to={`/exercise-types/${exercise.exercise_type.id}`}
                aria-label={`View details for ${exercise.exercise_type.name}`}
                title="View exercise details"
              >
                <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Link>
            </Button>
          </div>
        </div>
        <Dialog open={showExerciseModal} onOpenChange={setShowExerciseModal}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exercise Settings</DialogTitle>
            </DialogHeader>
            <ExerciseTypeMore
              currentIntensityUnit={currentIntensityUnit}
              onIntensityUnitChange={handleIntensityUnitChange}
              onExerciseDelete={handleExerciseDelete}
              disableExerciseDelete={isUnsavedExercise}
              onClose={() => setShowExerciseModal(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="pt-0">
        {/* Sets Table Header */}
        <div
          className="mb-2 grid gap-2 text-xs font-medium text-gray-500 sm:gap-4 dark:text-gray-400"
          style={{ gridTemplateColumns: "30px 60px 1fr 40px 32px" }}
        >
          <div>SET</div>
          <div>{currentIntensityUnit.abbreviation.toUpperCase()}</div>
          <div>REPS</div>
          <div className="text-right">DONE</div>
          <div></div>
        </div>

        {/* Sets */}
        <div className="space-y-2">
          {exerciseSets.map((set, index) => {
            const savedIntensityValue = formatDecimal(set.intensity);
            const setKey = String(set.id);
            const intensityValue =
              intensityInputs[setKey] ??
              (savedIntensityValue === "-" ? "" : savedIntensityValue);

            const savedRepsValue = set.reps === null ? "" : String(set.reps);
            const repsValue = repsInputs[setKey] ?? savedRepsValue;

            return (
              <div
                key={set.id}
                className={`grid items-center gap-2 rounded p-2 sm:gap-4 ${set.done ? "bg-done" : "bg-secondary"
                  }`}
                style={{ gridTemplateColumns: "30px 60px 1fr 40px 32px" }}
              >
                <div className="text-muted-foreground font-medium">
                  <span>{index + 1}</span>
                </div>
                <div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={intensityValue}
                    data-testid="intensity-input"
                    onChange={(e) => {
                      const { value } = e.target;
                      setIntensityInputs((prev) => ({
                        ...prev,
                        [setKey]: value,
                      }));
                    }}
                    onBlur={(e) => {
                      const parsedValue = parseDecimalInput(
                        e.currentTarget.value,
                      );
                      if (parsedValue === null) {
                        const revertValue =
                          savedIntensityValue === "-"
                            ? ""
                            : savedIntensityValue;
                        setIntensityInputs((prev) => ({
                          ...prev,
                          [setKey]: revertValue,
                        }));
                        return;
                      }
                      if (parsedValue === set.intensity) {
                        const formattedValue =
                          formatIntensityInputValue(parsedValue);
                        setIntensityInputs((prev) => ({
                          ...prev,
                          [setKey]: formattedValue,
                        }));
                        return;
                      }
                      const formattedValue =
                        formatIntensityInputValue(parsedValue);
                      setIntensityInputs((prev) => ({
                        ...prev,
                        [setKey]: formattedValue,
                      }));
                      void updateSet(set.id, "weight", parsedValue);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        const revertValue =
                          savedIntensityValue === "-"
                            ? ""
                            : savedIntensityValue;
                        setIntensityInputs((prev) => ({
                          ...prev,
                          [setKey]: revertValue,
                        }));
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    className="input h-8 max-w-[10ch] min-w-[4ch] text-center sm:min-w-[6ch]"
                    disabled={set.done}
                  />
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-input h-6 w-6 border bg-transparent p-0"
                    onClick={() => decrementReps(set.id)}
                    disabled={set.done}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={repsValue}
                    onChange={(e) => {
                      const { value } = e.target;
                      if (value === "" || /^\d+$/.test(value)) {
                        setRepsInputs((prev) => ({
                          ...prev,
                          [setKey]: value,
                        }));
                      }
                    }}
                    onBlur={(e) => {
                      const val = e.target.value === "" ? null : parseInt(e.target.value);
                      if (val === null || !isNaN(val)) {
                        updateSet(set.id, "reps", val);
                      } else {
                        // Revert on invalid
                        setRepsInputs((prev) => ({
                          ...prev,
                          [setKey]: savedRepsValue,
                        }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    className="input h-8 max-w-[10ch] min-w-[4ch] text-center sm:min-w-[8ch]"
                    disabled={set.done}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-input h-6 w-6 border bg-transparent p-0"
                    onClick={() => incrementReps(set.id)}
                    disabled={set.done}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant={set.done ? "default" : "outline"}
                    size="sm"
                    className={`h-8 w-8 p-0 ${set.done ? "bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800" : "border-input border dark:border-gray-600"}`}
                    onClick={() => toggleSetCompletion(set.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Dialog
                    open={moreMenuModal?.setId === set.id}
                    onOpenChange={(open) => {
                      if (!open) {
                        setMoreMenuModal(null);
                        setSetNotesValue("");
                        setInitialSetNotesValue("");
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0 dark:hover:bg-gray-700"
                        onClick={() => {
                          const initialNotes = set.notes || "";
                          setMoreMenuModal({
                            exerciseId: exercise.id,
                            setId: set.id,
                          });
                          setSetNotesValue(initialNotes);
                          setInitialSetNotesValue(initialNotes);
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Set Notes & Options</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Notes for Set{" "}
                            {exerciseSets.findIndex(
                              (s) => String(s.id) === String(set.id),
                            ) + 1}
                          </label>
                          <Textarea
                            placeholder="Add notes for this set..."
                            value={setNotesValue}
                            onChange={(e) => {
                              setSetNotesValue(e.target.value);
                            }}
                            className="min-h-[100px]"
                          />
                        </div>
                        <div className="flex items-center justify-between border-t pt-2">
                          <Button
                            variant="outline"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                            onClick={() => {
                              deleteSet(set.id);
                              setMoreMenuModal(null);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Set
                          </Button>
                          <Button
                            onClick={() => {
                              setMoreMenuModal(null);
                            }}
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            );
          })}
        </div>

        <Button
          variant="outline"
          className="mt-4 w-full bg-transparent"
          data-testid="add-set-button"
          disabled={isUnsavedExercise}
          onClick={() => addSet(exercise.id)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Set
        </Button>
      </div>
      <div className="bg-border mt-6 h-px w-full" />
    </div>
  );
};

export default memo(ExerciseRow);
