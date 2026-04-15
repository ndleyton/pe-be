import { Check, Minus, MoreVertical, Plus, Trash2 } from "lucide-react";

import type { ExerciseSet } from "@/features/exercises/api";
import {
  EXERCISE_SETS_GRID_CLASSES,
  formatIntensityInputValue,
} from "@/features/exercises/lib/exerciseRow";
import {
  convertIntensityValue,
  prefersDurationForIntensityUnit,
} from "@/features/exercises/lib/intensityUnits";
import {
  canUpdateDurationInputValue,
  formatDurationInputValue,
  parseDurationInputValue,
  resolveSetValueMode,
  type SetValueMode,
} from "@/features/exercises/lib/setValue";
import { parseDecimalInput } from "@/utils/format";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
} from "@/shared/components/ui";
import { Slider } from "@/shared/components/ui/slider";

type ExerciseSetTableProps = {
  activeSetId: string | number | null;
  currentIntensityUnitAbbreviation: string;
  currentIntensityUnitId: number;
  durationInputs: Record<string, string>;
  exerciseSets: ExerciseSet[];
  intensityInputs: Record<string, string>;
  isUnsavedExercise: boolean;
  onAddSet: () => void;
  onCloseSetOptions: () => void;
  onDecrementReps: (setId: string | number) => void;
  onDeleteSet: (setId: string | number) => void | Promise<void>;
  onIncrementReps: (setId: string | number) => void;
  onOpenSetOptions: (
    setId: string | number,
    initialNotes: string,
    initialRpe: number | null | undefined,
    initialRir: number | null | undefined,
  ) => void;
  onSetOptionsOpenChange: (open: boolean) => void;
  onSetDurationInputValue: (setId: string | number, value: string) => void;
  onSetNotesValueChange: (value: string) => void;
  onSetRepsInputValue: (setId: string | number, value: string) => void;
  onSetRpeValueChange: (value: number | null) => void;
  onSetRirValueChange: (value: number | null) => void;
  onSetValueModeChange: (setId: string | number, mode: SetValueMode) => void;
  onSetWeightInputValue: (setId: string | number, value: string) => void;
  onToggleSetCompletion: (setId: string | number) => void | Promise<void>;
  onUpdateSetField: (
    setId: string | number,
    field: "weight" | "reps" | "duration_seconds",
    value: number | null,
    displayUnitId?: number,
  ) => void;
  repsInputs: Record<string, string>;
  setNotesValue: string;
  setRpeValue: number | null;
  setRirValue: number | null;
};

export const ExerciseSetTable = ({
  activeSetId,
  currentIntensityUnitAbbreviation,
  currentIntensityUnitId,
  durationInputs,
  exerciseSets,
  intensityInputs,
  isUnsavedExercise,
  onAddSet,
  onCloseSetOptions,
  onDecrementReps,
  onDeleteSet,
  onIncrementReps,
  onOpenSetOptions,
  onSetOptionsOpenChange,
  onSetDurationInputValue,
  onSetNotesValueChange,
  onSetRepsInputValue,
  onSetRpeValueChange,
  onSetRirValueChange,
  onSetValueModeChange,
  onSetWeightInputValue,
  onToggleSetCompletion,
  onUpdateSetField,
  repsInputs,
  setNotesValue,
  setRpeValue,
  setRirValue,
}: ExerciseSetTableProps) => {
  const prefersTimeByDefault = prefersDurationForIntensityUnit(
    currentIntensityUnitId,
  );

  return (
    <>
      <div
        className={`bg-card/50 border-border/10 mb-3 grid items-center gap-2 rounded-lg border-b px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 sm:gap-4 ${EXERCISE_SETS_GRID_CLASSES}`}
      >
        <div className="text-center">SET</div>
        <div className="text-center">
          {currentIntensityUnitAbbreviation.toUpperCase()}
        </div>
        <div className="text-center">
          {prefersTimeByDefault ? "TIME" : "REPS"}
        </div>
        <div className="text-right pr-2">DONE</div>
        <div></div>
      </div>

      <div className="space-y-2">
        {exerciseSets.map((set, index) => {
          const setKey = String(set.id);
          const effortLabelId = `set-effort-label-${set.id}`;
          const savedDisplayIntensity = convertIntensityValue(
            set.intensity,
            set.intensity_unit_id,
            currentIntensityUnitId,
          );
          const savedIntensityValue =
            formatIntensityInputValue(savedDisplayIntensity);
          const intensityValue = intensityInputs[setKey] ?? savedIntensityValue;
          const savedRepsValue = set.reps === null ? "" : String(set.reps);
          const repsValue = repsInputs[setKey] ?? savedRepsValue;
          const savedDurationValue = formatDurationInputValue(
            set.duration_seconds,
          );
          const durationValue = durationInputs[setKey] ?? savedDurationValue;
          const setValueMode = resolveSetValueMode(set, prefersTimeByDefault);
          const isTimeMode = setValueMode === "time";

          return (
            <div
              key={set.id}
              className={`grid items-center gap-2 rounded-lg border p-2.5 transition-all duration-200 sm:gap-4 ${EXERCISE_SETS_GRID_CLASSES} ${set.done
                ? "bg-done/10 border-done/20 shadow-inner"
                : "bg-muted/50 border-transparent shadow-sm"
                }`}
            >
              <div className="bg-muted/40 flex h-8 w-8 items-center justify-center rounded-lg">
                <span className="text-muted-foreground text-xs font-black">
                  {index + 1}
                </span>
              </div>
              <div className="min-w-0 flex justify-center">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={intensityValue}
                  data-testid="intensity-input"
                  onChange={(event) =>
                    onSetWeightInputValue(set.id, event.target.value)
                  }
                  onBlur={(event) => {
                    const parsedValue = parseDecimalInput(
                      event.currentTarget.value,
                    );

                    if (parsedValue === null) {
                      onSetWeightInputValue(set.id, savedIntensityValue);
                      return;
                    }

                    if (parsedValue === savedDisplayIntensity) {
                      onSetWeightInputValue(
                        set.id,
                        formatIntensityInputValue(parsedValue),
                      );
                      return;
                    }

                    onSetWeightInputValue(
                      set.id,
                      formatIntensityInputValue(parsedValue),
                    );
                    onUpdateSetField(
                      set.id,
                      "weight",
                      parsedValue,
                      currentIntensityUnitId,
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      (event.currentTarget as HTMLInputElement).blur();
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      onSetWeightInputValue(set.id, savedIntensityValue);
                      (event.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  className="input h-8 max-w-[10ch] min-w-[4ch] text-center sm:min-w-[6ch]"
                  disabled={set.done}
                />
              </div>

              {isTimeMode ? (
                <div className="min-w-0 flex justify-center">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={durationValue}
                    placeholder="00:00"
                    data-testid="time-input"
                    onChange={(event) => {
                      const { value } = event.target;
                      if (canUpdateDurationInputValue(value)) {
                        onSetDurationInputValue(set.id, value);
                      }
                    }}
                    onBlur={(event) => {
                      const parsedValue = parseDurationInputValue(
                        event.currentTarget.value,
                      );

                      if (
                        parsedValue === null &&
                        event.currentTarget.value.trim() !== ""
                      ) {
                        onSetDurationInputValue(set.id, savedDurationValue);
                        return;
                      }

                      onUpdateSetField(set.id, "duration_seconds", parsedValue);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        (event.currentTarget as HTMLInputElement).blur();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        onSetDurationInputValue(set.id, savedDurationValue);
                        (event.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    className="input h-8 max-w-[10ch] min-w-[6ch] text-center sm:min-w-[8ch]"
                    disabled={set.done}
                  />
                </div>
              ) : (
                <div className="min-w-0 flex items-center justify-center gap-0.5 sm:gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-input h-6 w-6 border bg-transparent p-0"
                    onClick={() => onDecrementReps(set.id)}
                    disabled={set.done}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={repsValue}
                    onChange={(event) => {
                      const { value } = event.target;
                      if (value === "" || /^\d+$/.test(value)) {
                        onSetRepsInputValue(set.id, value);
                      }
                    }}
                    onBlur={(event) => {
                      const parsedValue =
                        event.currentTarget.value === ""
                          ? null
                          : Number.parseInt(event.currentTarget.value, 10);

                      if (parsedValue === null || !Number.isNaN(parsedValue)) {
                        onUpdateSetField(set.id, "reps", parsedValue);
                        return;
                      }

                      onSetRepsInputValue(set.id, savedRepsValue);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        (event.currentTarget as HTMLInputElement).blur();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        onSetRepsInputValue(set.id, savedRepsValue);
                        event.currentTarget.value = savedRepsValue;
                        (event.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    className="input h-8 max-w-[10ch] min-w-[4ch] text-center sm:min-w-[8ch]"
                    disabled={set.done}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-input h-6 w-6 border bg-transparent p-0"
                    onClick={() => onIncrementReps(set.id)}
                    disabled={set.done}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant={set.done ? "default" : "ghost"}
                  size="sm"
                  className={`group h-10 w-10 rounded-xl transition-all duration-300 ${set.done
                    ? "bg-done text-done-foreground scale-110 shadow-lg ring-4 ring-done/20"
                    : "border-done/45 bg-done/15 text-done-foreground/80 border-2 shadow-sm hover:border-done hover:bg-done/40 dark:bg-done/10 dark:text-done-foreground/70"
                    }`}
                  onClick={() => onToggleSetCompletion(set.id)}
                >
                  <Check
                    className={`h-6 w-6 transition-all duration-300 ${set.done
                      ? "scale-110 opacity-100"
                      : "scale-90 opacity-50 group-hover:opacity-100 dark:opacity-70"
                      }`}
                  />
                </Button>
              </div>

              <div className="flex justify-end">
                <Dialog
                  open={String(activeSetId) === String(set.id)}
                  onOpenChange={onSetOptionsOpenChange}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0 dark:hover:bg-gray-700"
                      onClick={() =>
                        onOpenSetOptions(set.id, set.notes || "", set.rpe ?? null, set.rir ?? null)
                      }
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Set Notes & Options</DialogTitle>
                      <DialogDescription>
                        Add notes for this set or remove it from the exercise.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Tracking
                        </label>
                        <div className="bg-muted inline-flex items-center gap-1 rounded-lg border p-1">
                          <button
                            type="button"
                            aria-pressed={setValueMode === "reps"}
                            onClick={() => onSetValueModeChange(set.id, "reps")}
                            disabled={set.done}
                            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${setValueMode === "reps"
                              ? "bg-background text-foreground shadow"
                              : "text-muted-foreground hover:text-foreground"
                              }`}
                          >
                            Reps
                          </button>
                          <button
                            type="button"
                            aria-pressed={setValueMode === "time"}
                            onClick={() => onSetValueModeChange(set.id, "time")}
                            disabled={set.done}
                            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${setValueMode === "time"
                              ? "bg-background text-foreground shadow"
                              : "text-muted-foreground hover:text-foreground"
                              }`}
                          >
                            Time
                          </button>
                        </div>
                      </div>
                      <div>
                        <label
                          id={effortLabelId}
                          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Effort
                        </label>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>
                              {setRpeValue == null
                                ? "Not set"
                                : `RPE ${setRpeValue}`}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => onSetRpeValueChange(null)}
                            >
                              Clear
                            </Button>
                          </div>
                          <Slider
                            value={[setRpeValue ?? 0]}
                            min={0}
                            max={10}
                            step={0.5}
                            className="mx-auto w-full max-w-xs"
                            aria-labelledby={effortLabelId}
                            aria-valuetext={
                              setRpeValue == null
                                ? "Not set"
                                : `Effort ${setRpeValue}`
                            }
                            onValueChange={(values: number[]) =>
                              onSetRpeValueChange(values[0] ?? null)
                            }
                          />
                        </div>
                      </div>
                      {setValueMode === "reps" && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Reps in Reserve
                          </label>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>
                                {setRirValue == null
                                  ? "Not set"
                                  : `RIR ${setRirValue}`}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() => onSetRirValueChange(null)}
                              >
                                Clear
                              </Button>
                            </div>
                            <Slider
                              value={[setRirValue ?? 0]}
                              min={0}
                              max={10}
                              step={0.5}
                              className="mx-auto w-full max-w-xs"
                              aria-valuetext={
                                setRirValue == null
                                  ? "Not set"
                                  : `Reps in Reserve ${setRirValue}`
                              }
                              onValueChange={(values: number[]) =>
                                onSetRirValueChange(values[0] ?? null)
                              }
                            />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Notes for Set {index + 1}
                        </label>
                        <Textarea
                          placeholder="Add notes for this set..."
                          value={setNotesValue}
                          onChange={(event) =>
                            onSetNotesValueChange(event.target.value)
                          }
                          className="min-h-[100px]"
                        />
                      </div>
                      <div className="flex items-center justify-between border-t pt-2">
                        <Button
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                          onClick={() => {
                            void onDeleteSet(set.id);
                            onCloseSetOptions();
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Set
                        </Button>
                        <Button variant="glass" onClick={onCloseSetOptions}>
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
        variant="glass"
        className="mt-6 w-full rounded-xl border-border/40 bg-card/60 py-6 text-foreground shadow-sm transition-all hover:scale-[1.01] hover:bg-card/80 dark:bg-card/60 dark:border-border/60"
        data-testid="add-set-button"
        disabled={isUnsavedExercise}
        onClick={onAddSet}
      >
        <Plus className="mr-2 h-5 w-5" />
        <span className="font-bold tracking-tight">Add Set</span>
      </Button>
    </>
  );
};
