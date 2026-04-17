import { memo, useEffect, useMemo, useState } from "react";
import { ExternalLink, Info, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";

import {
  formatSetSummary,
  type RoutineEditorSet,
  type RoutineEditorTemplate,
} from "@/features/routines/lib/routineEditor";
import { prefersDurationForIntensityUnit } from "@/features/exercises/lib/intensityUnits";
import {
  canUpdateDurationInputValue,
  formatDurationInputValue,
  parseDurationInputValue,
  resolveSetValueMode,
} from "@/features/exercises/lib/setValue";
import {
  getRirDescription,
  getRpeDescription,
} from "@/features/exercises/lib/exerciseRow";
import { Textarea } from "@/shared/components/ui/textarea";
import { formatDecimal, parseDecimalInput } from "@/utils/format";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Slider } from "@/shared/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

const preloadExerciseTypeDetailsPage = createIntentPreload(() =>
  import("@/features/exercises/pages/ExerciseTypeDetailsPage"),
);

type RoutineTemplatesCardProps = {
  canEdit: boolean;
  editorTemplates: RoutineEditorTemplate[];
  onAddExercise: () => void;
  onAddSet: (templateId: string) => void;
  onChangeExercise: (templateId: string) => void;
  onRemoveSet: (templateId: string, setId: string) => void;
  onRemoveTemplate: (templateId: string) => void;
  onSelectUnit: (templateId: string, setId: string) => void;
  onUpdateSet: (
    templateId: string,
    setId: string,
    updates: Partial<RoutineEditorSet>,
  ) => void;
  onUpdateTemplate: (
    templateId: string,
    updates: Partial<RoutineEditorTemplate>,
  ) => void;
};

type ActiveSetTarget = {
  templateId: string;
  setId: string;
};

type EditableRoutineSetRowProps = {
  templateId: string;
  templateIndex: number;
  setIndex: number;
  setTemplate: RoutineEditorSet;
  onOpenDetails: (templateId: string, setId: string) => void;
  onRemoveSet: (templateId: string, setId: string) => void;
  onSelectUnit: (templateId: string, setId: string) => void;
  onUpdateSet: (
    templateId: string,
    setId: string,
    updates: Partial<RoutineEditorSet>,
  ) => void;
};

const EditableRoutineSetRow = memo(
  ({
    templateId,
    templateIndex,
    setIndex,
    setTemplate,
    onOpenDetails,
    onRemoveSet,
    onSelectUnit,
    onUpdateSet,
  }: EditableRoutineSetRowProps) => {
    const [durationDraft, setDurationDraft] = useState(() =>
      formatDurationInputValue(setTemplate.duration_seconds),
    );

    useEffect(() => {
      setDurationDraft((currentDraft) => {
        const formattedDuration = formatDurationInputValue(
          setTemplate.duration_seconds,
        );
        const parsedDraft =
          currentDraft == null ? null : parseDurationInputValue(currentDraft);

        if (
          currentDraft.trim() !== "" &&
          parsedDraft == null
        ) {
          return currentDraft;
        }

        if (parsedDraft === (setTemplate.duration_seconds ?? null)) {
          return currentDraft;
        }

        return formattedDuration;
      });
    }, [setTemplate.duration_seconds, setTemplate.id]);

    const prefersTimeByDefault = prefersDurationForIntensityUnit(
      setTemplate.intensity_unit_id,
    );
    const setValueMode = resolveSetValueMode(
      setTemplate,
      prefersTimeByDefault,
    );
    const isTimeMode = setValueMode === "time";

    return (
      <div
        data-testid={`routine-template-${templateIndex}-set-${setIndex}`}
        className="rounded-xl border border-border/30 bg-background/50 px-3 py-4 shadow-sm backdrop-blur-sm"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border/10 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/10 bg-primary/5 text-[10px] font-black">
              {setIndex + 1}
            </div>
            <div className="min-w-0 break-words text-xs font-black uppercase tracking-widest opacity-80">
              {formatSetSummary(setTemplate)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`Edit set ${setIndex + 1} details`}
              onClick={() => onOpenDetails(templateId, setTemplate.id)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            <Button
              data-testid={`remove-routine-set-${templateIndex}-${setIndex}`}
              variant="ghost"
              size="sm"
              aria-label={`Remove set ${setIndex + 1}`}
              onClick={() => onRemoveSet(templateId, setTemplate.id)}
              className="h-8 w-8 rounded-lg p-0 text-muted-foreground transition-all hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-1.5">
            <label
              htmlFor={`${templateId}-${setTemplate.id}-${isTimeMode ? "time" : "reps"}`}
              className="ml-1 text-[10px] font-black uppercase tracking-widest opacity-40"
            >
              {isTimeMode ? "Time" : "Reps"}
            </label>
            {isTimeMode ? (
              <Input
                id={`${templateId}-${setTemplate.id}-time`}
                data-testid={`routine-set-time-${templateIndex}-${setIndex}`}
                type="text"
                inputMode="numeric"
                value={durationDraft}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (!canUpdateDurationInputValue(nextValue)) {
                    return;
                  }

                  setDurationDraft(nextValue);

                  const parsedDuration = parseDurationInputValue(nextValue);
                  if (parsedDuration == null) {
                    return;
                  }

                  onUpdateSet(templateId, setTemplate.id, {
                    reps: null,
                    duration_seconds: parsedDuration,
                  });
                }}
                onBlur={() => {
                  const parsedDuration = parseDurationInputValue(durationDraft);

                  if (durationDraft.trim() === "") {
                    onUpdateSet(templateId, setTemplate.id, {
                      reps: null,
                      duration_seconds: null,
                    });
                    return;
                  }

                  if (parsedDuration == null) {
                    setDurationDraft(
                      formatDurationInputValue(setTemplate.duration_seconds),
                    );
                    return;
                  }

                  onUpdateSet(templateId, setTemplate.id, {
                    reps: null,
                    duration_seconds: parsedDuration,
                  });
                }}
                placeholder="00:00"
                className="h-10 rounded-xl border-primary/5 bg-primary/5 text-center font-semibold transition-all focus:border-primary/20"
              />
            ) : (
              <Input
                id={`${templateId}-${setTemplate.id}-reps`}
                data-testid={`routine-set-reps-${templateIndex}-${setIndex}`}
                type="number"
                min="0"
                step="1"
                value={setTemplate.reps ?? ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onUpdateSet(templateId, setTemplate.id, {
                    reps:
                      nextValue.trim() === ""
                        ? null
                        : Number.parseInt(nextValue, 10),
                    duration_seconds: null,
                  });
                }}
                placeholder="0"
                className="h-10 rounded-xl border-primary/5 bg-primary/5 text-center font-semibold transition-all focus:border-primary/20"
              />
            )}
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor={`${templateId}-${setTemplate.id}-intensity`}
              className="ml-1 text-[10px] font-black uppercase tracking-widest opacity-40"
            >
              Intensity
            </label>
            <Input
              id={`${templateId}-${setTemplate.id}-intensity`}
              data-testid={`routine-set-intensity-${templateIndex}-${setIndex}`}
              inputMode="decimal"
              value={
                setTemplate.intensity != null
                  ? formatDecimal(setTemplate.intensity)
                  : ""
              }
              onChange={(event) =>
                onUpdateSet(templateId, setTemplate.id, {
                  intensity: parseDecimalInput(event.target.value),
                })
              }
              placeholder="0.0"
              className="h-10 rounded-xl border-primary/5 bg-primary/5 text-center font-semibold transition-all focus:border-primary/20"
            />
          </div>

          <div className="grid gap-1.5">
            <span className="ml-1 text-[10px] font-black uppercase tracking-widest opacity-40">
              Unit
            </span>
            <Button
              data-testid={`routine-set-unit-${templateIndex}-${setIndex}`}
              variant="outline"
              className="h-10 justify-between rounded-xl border-primary/5 bg-primary/5 text-xs font-semibold transition-all hover:border-primary/20"
              onClick={() => onSelectUnit(templateId, setTemplate.id)}
            >
              <span className="truncate">
                {setTemplate.intensity_unit
                  ? setTemplate.intensity_unit.abbreviation
                  : "---"}
              </span>
              <span className="text-[8px] uppercase opacity-40">
                Change
              </span>
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

EditableRoutineSetRow.displayName = "EditableRoutineSetRow";

type ReadOnlyRoutineSetRowProps = {
  setIndex: number;
  setTemplate: RoutineEditorSet;
};

const ReadOnlyRoutineSetRow = memo(
  ({ setIndex, setTemplate }: ReadOnlyRoutineSetRowProps) => (
    <div className="flex w-full items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 shadow-lg shadow-primary/5 backdrop-blur-sm">
      <span className="mt-0.5 text-[10px] font-black text-primary opacity-40">
        {setIndex + 1}
      </span>
      <span className="min-w-0 break-words text-sm font-bold tracking-tight italic text-foreground opacity-90">
        {formatSetSummary(setTemplate)}
      </span>
    </div>
  ),
);

ReadOnlyRoutineSetRow.displayName = "ReadOnlyRoutineSetRow";

type RoutineTemplateSectionProps = {
  canEdit: boolean;
  template: RoutineEditorTemplate;
  templateIndex: number;
  onAddSet: (templateId: string) => void;
  onChangeExercise: (templateId: string) => void;
  onOpenSetDetails: (templateId: string, setId: string) => void;
  onRemoveSet: (templateId: string, setId: string) => void;
  onRemoveTemplate: (templateId: string) => void;
  onSelectUnit: (templateId: string, setId: string) => void;
  onUpdateSet: (
    templateId: string,
    setId: string,
    updates: Partial<RoutineEditorSet>,
  ) => void;
  onUpdateTemplate: (
    templateId: string,
    updates: Partial<RoutineEditorTemplate>,
  ) => void;
};

const RoutineTemplateSection = memo(
  ({
    canEdit,
    template,
    templateIndex,
    onAddSet,
    onChangeExercise,
    onOpenSetDetails,
    onRemoveSet,
    onRemoveTemplate,
    onSelectUnit,
    onUpdateSet,
    onUpdateTemplate,
  }: RoutineTemplateSectionProps) => (
    <div
      data-testid={`routine-template-${templateIndex}`}
      className="rounded-2xl border border-border/40 bg-muted/20 p-4 shadow-sm transition-all hover:bg-muted/30"
    >
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-border/10 pb-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background text-xl font-black shadow-inner">
            {templateIndex + 1}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-lg font-black leading-tight tracking-tight">
              {template.exercise_type?.name ?? "Missing Selection"}
            </h2>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                {template.set_templates.length} set
                {template.set_templates.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-1">
          {template.exercise_type ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-xl p-0 hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-800"
              asChild
              onMouseEnter={preloadExerciseTypeDetailsPage}
              onTouchStart={preloadExerciseTypeDetailsPage}
              onFocus={preloadExerciseTypeDetailsPage}
              onClick={(event) => event.stopPropagation()}
            >
              <Link
                to={`/exercise-types/${template.exercise_type.id}`}
                aria-label={`View details for ${template.exercise_type.name}`}
                title="View exercise details"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100" />
              </Link>
            </Button>
          ) : null}
          {canEdit ? (
            <>
              <Button
                data-testid={`change-routine-exercise-${templateIndex}`}
                variant="outline"
                size="sm"
                aria-label={`Change exercise ${templateIndex + 1}`}
                onClick={() => onChangeExercise(template.id)}
                className="h-8 w-8 rounded-xl border-border/60 p-0 shadow-sm transition-all hover:bg-muted"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                data-testid={`remove-routine-template-${templateIndex}`}
                variant="ghost"
                size="sm"
                aria-label={`Remove exercise ${templateIndex + 1}`}
                onClick={() => onRemoveTemplate(template.id)}
                className="h-8 w-8 rounded-xl p-0 text-destructive transition-all hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {canEdit || template.notes ? (
        <div className="mb-6">
          {!canEdit && template.notes ? (
            <p className="max-w-md text-xs italic leading-relaxed text-muted-foreground">
              {template.notes}
            </p>
          ) : null}
          {canEdit ? (
            <div className="space-y-1.5">
              <label
                htmlFor={`${template.id}-notes`}
                className="ml-1 text-[10px] font-black uppercase tracking-widest opacity-40"
              >
                Coaching Notes
              </label>
              <Textarea
                id={`${template.id}-notes`}
                placeholder="e.g. Focus on tempo, keep core tight..."
                value={template.notes}
                onChange={(event) =>
                  onUpdateTemplate(template.id, { notes: event.target.value })
                }
                className="min-h-[80px] resize-none cursor-text rounded-2xl border-primary/5 bg-primary/5 text-sm shadow-inner transition-all focus:border-primary/20"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={canEdit ? "space-y-3" : "mt-2 space-y-2"}>
        {template.set_templates.map((setTemplate, setIndex) =>
          canEdit ? (
            <EditableRoutineSetRow
              key={setTemplate.id}
              templateId={template.id}
              templateIndex={templateIndex}
              setIndex={setIndex}
              setTemplate={setTemplate}
              onOpenDetails={onOpenSetDetails}
              onRemoveSet={onRemoveSet}
              onSelectUnit={onSelectUnit}
              onUpdateSet={onUpdateSet}
            />
          ) : (
            <ReadOnlyRoutineSetRow
              key={setTemplate.id}
              setIndex={setIndex}
              setTemplate={setTemplate}
            />
          ),
        )}
      </div>

      {canEdit ? (
        <Button
          data-testid={`add-routine-set-${templateIndex}`}
          variant="secondary"
          size="sm"
          className="mt-4 h-10 w-full rounded-xl border border-primary/30 bg-primary/20 text-xs font-bold uppercase tracking-widest transition-all hover:bg-primary/20"
          onClick={() => onAddSet(template.id)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Set
        </Button>
      ) : null}
    </div>
  ),
);

RoutineTemplateSection.displayName = "RoutineTemplateSection";

type SetDetailsDialogProps = {
  activeSetTarget: ActiveSetTarget | null;
  editorTemplates: RoutineEditorTemplate[];
  onClose: () => void;
  onUpdateSet: (
    templateId: string,
    setId: string,
    updates: Partial<RoutineEditorSet>,
  ) => void;
};

const SetDetailsDialog = ({
  activeSetTarget,
  editorTemplates,
  onClose,
  onUpdateSet,
}: SetDetailsDialogProps) => {
  const activeTemplate = useMemo(
    () =>
      activeSetTarget == null
        ? null
        : editorTemplates.find((template) => template.id === activeSetTarget.templateId) ??
          null,
    [activeSetTarget, editorTemplates],
  );

  const activeSetTemplate = useMemo(
    () =>
      activeSetTarget == null || activeTemplate == null
        ? null
        : activeTemplate.set_templates.find(
            (setTemplate) => setTemplate.id === activeSetTarget.setId,
          ) ?? null,
    [activeSetTarget, activeTemplate],
  );

  const setIndex = useMemo(
    () =>
      activeTemplate == null || activeSetTemplate == null
        ? -1
        : activeTemplate.set_templates.indexOf(activeSetTemplate),
    [activeSetTemplate, activeTemplate],
  );

  const effortLabelId = "set-effort-label-active";
  const setValueMode =
    activeSetTemplate == null
      ? "reps"
      : resolveSetValueMode(
          activeSetTemplate,
          prefersDurationForIntensityUnit(activeSetTemplate.intensity_unit_id),
        );

  return (
    <TooltipProvider>
      <Dialog
        open={activeSetTarget !== null}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="max-w-md">
          {activeTemplate && activeSetTemplate ? (
            <>
              <DialogHeader>
                <DialogTitle>Set {setIndex + 1} Details</DialogTitle>
                <DialogDescription>
                  Configure coaching targets for this set template.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <label className="ml-1 block text-[10px] font-black uppercase tracking-widest opacity-40">
                    Tracking
                  </label>
                  <div className="bg-muted inline-flex items-center gap-1 rounded-lg border p-1">
                    <button
                      type="button"
                      aria-pressed={setValueMode === "reps"}
                      onClick={() =>
                        onUpdateSet(activeTemplate.id, activeSetTemplate.id, {
                          type: "reps",
                        })
                      }
                      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                        setValueMode === "reps"
                          ? "bg-background text-foreground shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Reps
                    </button>
                    <button
                      type="button"
                      aria-pressed={setValueMode === "time"}
                      onClick={() =>
                        onUpdateSet(activeTemplate.id, activeSetTemplate.id, {
                          type: "time",
                        })
                      }
                      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                        setValueMode === "time"
                          ? "bg-background text-foreground shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Time
                    </button>
                  </div>
                </div>

                <div className="flex items-stretch justify-center gap-8">
                  <div
                    className={`flex min-w-0 flex-col items-center ${
                      setValueMode === "reps"
                        ? "flex-1"
                        : "w-full max-w-[240px]"
                    }`}
                  >
                    <div className="mb-2 flex w-full items-center justify-between">
                      <label
                        id={effortLabelId}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        RPE
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 cursor-help opacity-50 transition-opacity hover:opacity-100" />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-[200px] text-center"
                          >
                            Rate of Perceived Exertion: A scale from 0-10 to
                            measure intentional intensity.
                          </TooltipContent>
                        </Tooltip>
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          onUpdateSet(activeTemplate.id, activeSetTemplate.id, {
                            rpe: null,
                          })
                        }
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="flex w-full flex-col items-center gap-4">
                      <div className="flex h-32 w-full items-center justify-center">
                        <Slider
                          orientation="vertical"
                          value={[activeSetTemplate.rpe ?? 0]}
                          min={0}
                          max={10}
                          step={0.5}
                          className="h-full"
                          aria-labelledby={effortLabelId}
                          onValueChange={(values) =>
                            onUpdateSet(activeTemplate.id, activeSetTemplate.id, {
                              rpe: values[0] ?? null,
                            })
                          }
                        />
                      </div>
                      <div className="flex min-h-[40px] flex-col items-center gap-0.5">
                        <span className="text-xl font-black tabular-nums">
                          {activeSetTemplate.rpe == null
                            ? "—"
                            : activeSetTemplate.rpe}
                        </span>
                        <span className="max-w-[100px] text-center text-[8px] leading-tight font-medium text-muted-foreground">
                          {getRpeDescription(activeSetTemplate.rpe)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {setValueMode === "reps" ? (
                    <>
                      <div className="w-px self-stretch bg-border/30" />
                      <div className="flex flex-1 min-w-0 flex-col items-center">
                        <div className="mb-2 flex w-full items-center justify-between">
                          <label
                            id="set-rir-label-active"
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                          >
                            RIR
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 cursor-help opacity-50 transition-opacity hover:opacity-100" />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-[200px] text-center"
                              >
                                Reps In Reserve: Target number of reps left in
                                the tank before failure.
                              </TooltipContent>
                            </Tooltip>
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              onUpdateSet(activeTemplate.id, activeSetTemplate.id, {
                                rir: null,
                              })
                            }
                          >
                            Clear
                          </Button>
                        </div>

                        <div className="flex w-full flex-col items-center gap-4">
                          <div className="flex h-32 w-full items-center justify-center">
                            <Slider
                              orientation="vertical"
                              value={[
                                activeSetTemplate.rir == null
                                  ? 0
                                  : 10 - activeSetTemplate.rir,
                              ]}
                              min={0}
                              max={10}
                              step={0.5}
                              className="h-full"
                              aria-labelledby="set-rir-label-active"
                              aria-valuetext={
                                activeSetTemplate.rir == null
                                  ? "RIR not set"
                                  : `RIR: ${activeSetTemplate.rir} reps remaining`
                              }
                              onValueChange={(values) => {
                                const value = values[0] ?? 0;
                                onUpdateSet(activeTemplate.id, activeSetTemplate.id, {
                                  rir: 10 - value,
                                });
                              }}
                            />
                          </div>
                          <div className="flex min-h-[40px] flex-col items-center gap-0.5">
                            <span className="text-xl font-black tabular-nums">
                              {activeSetTemplate.rir == null
                                ? "—"
                                : activeSetTemplate.rir}
                            </span>
                            <span className="max-w-[100px] text-center text-[8px] leading-tight font-medium text-muted-foreground">
                              {getRirDescription(activeSetTemplate.rir)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={`set-notes-${activeSetTemplate.id}`}
                    className="ml-1 text-[10px] font-black uppercase tracking-widest opacity-40"
                  >
                    Set-Specific Notes
                  </label>
                  <Textarea
                    id={`set-notes-${activeSetTemplate.id}`}
                    placeholder="e.g. Pause at the bottom, explosive up..."
                    value={activeSetTemplate.notes}
                    onChange={(event) =>
                      onUpdateSet(activeTemplate.id, activeSetTemplate.id, {
                        notes: event.target.value,
                      })
                    }
                    className="min-h-[80px] rounded-xl border-primary/5 bg-primary/5 text-sm transition-all focus:border-primary/20"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="glass" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export const RoutineTemplatesCard = ({
  canEdit,
  editorTemplates,
  onAddExercise,
  onAddSet,
  onChangeExercise,
  onRemoveSet,
  onRemoveTemplate,
  onSelectUnit,
  onUpdateSet,
  onUpdateTemplate,
}: RoutineTemplatesCardProps) => {
  const [activeSetTarget, setActiveSetTarget] = useState<ActiveSetTarget | null>(
    null,
  );

  return (
    <Card className="overflow-hidden rounded-2xl border border-border/40 bg-card/80 p-2 text-left shadow-xl backdrop-blur-md">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
                Exercise Sequence
              </h4>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {editorTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-primary/5 p-12 text-center text-sm italic text-muted-foreground">
            No exercise templates yet. Add one to start building the routine.
          </div>
        ) : (
          editorTemplates.map((template, templateIndex) => (
            <RoutineTemplateSection
              key={template.id}
              canEdit={canEdit}
              template={template}
              templateIndex={templateIndex}
              onAddSet={onAddSet}
              onChangeExercise={onChangeExercise}
              onOpenSetDetails={(templateId, setId) =>
                setActiveSetTarget({ templateId, setId })
              }
              onRemoveSet={onRemoveSet}
              onRemoveTemplate={onRemoveTemplate}
              onSelectUnit={onSelectUnit}
              onUpdateSet={onUpdateSet}
              onUpdateTemplate={onUpdateTemplate}
            />
          ))
        )}

        {canEdit ? (
          <div className="mt-12 space-y-8">
            <div className="flex items-center justify-center pb-8">
              <Button
                data-testid="add-routine-exercise-button"
                onClick={onAddExercise}
                className="h-14 rounded-full border border-primary/40 bg-primary/10 px-8 py-2 font-bold text-primary shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Exercise
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      <SetDetailsDialog
        activeSetTarget={activeSetTarget}
        editorTemplates={editorTemplates}
        onClose={() => setActiveSetTarget(null)}
        onUpdateSet={onUpdateSet}
      />
    </Card>
  );
};
