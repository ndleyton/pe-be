import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

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
import { Textarea } from "@/shared/components/ui/textarea";
import { formatDecimal, parseDecimalInput } from "@/utils/format";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

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

const buildDurationDrafts = (
  templates: RoutineEditorTemplate[],
): Record<string, string> => {
  const drafts: Record<string, string> = {};

  templates.forEach((template) => {
    template.set_templates.forEach((setTemplate) => {
      drafts[`${template.id}-${setTemplate.id}`] = formatDurationInputValue(
        setTemplate.duration_seconds,
      );
    });
  });

  return drafts;
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
  const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>(
    () => buildDurationDrafts(editorTemplates),
  );

  useEffect(() => {
    setDurationDrafts((current) => {
      const nextDrafts: Record<string, string> = {};

      editorTemplates.forEach((template) => {
        template.set_templates.forEach((setTemplate) => {
          const key = `${template.id}-${setTemplate.id}`;
          const formattedDuration = formatDurationInputValue(
            setTemplate.duration_seconds,
          );
          const currentDraft = current[key];
          const parsedDraft =
            currentDraft == null ? null : parseDurationInputValue(currentDraft);

          if (
            currentDraft != null &&
            parsedDraft == null &&
            currentDraft.trim() !== ""
          ) {
            nextDrafts[key] = currentDraft;
            return;
          }

          if (currentDraft != null && parsedDraft === (setTemplate.duration_seconds ?? null)) {
            nextDrafts[key] = currentDraft;
            return;
          }

          nextDrafts[key] = formattedDuration;
        });
      });

      return nextDrafts;
    });
  }, [editorTemplates]);

  return (
    <Card className="bg-card/80 border-border/40 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
                Exercise Sequence
              </h4>
            </div>
          </div>
          {canEdit && (
            <Button
              data-testid="add-routine-exercise-button"
              onClick={onAddExercise}
              size="sm"
              className="rounded-xl border border-primary/40 bg-primary/10 font-bold text-primary shadow-sm transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Exercise
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {editorTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground bg-primary/5 italic">
            No exercise templates yet. Add one to start building the routine.
          </div>
        ) : (
          editorTemplates.map((template, templateIndex) => (
          <div
            key={template.id}
            data-testid={`routine-template-${templateIndex}`}
            className="rounded-2xl border border-border/40 bg-muted/20 p-5 shadow-sm transition-all hover:bg-muted/30"
          >
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background border border-border/40 text-xl font-black shadow-inner">
                  {templateIndex + 1}
                </div>
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-black tracking-tight">
                    {template.exercise_type?.name ?? "Missing Selection"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {template.set_templates.length} set{template.set_templates.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {!canEdit && template.notes && (
                    <p className="mt-2 text-xs text-muted-foreground italic leading-relaxed max-w-md">
                      {template.notes}
                    </p>
                  )}
                  {canEdit && (
                    <div className="mt-3">
                      <label
                        htmlFor={`${template.id}-notes`}
                        className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1"
                      >
                        Coaching Notes
                      </label>
                      <Textarea
                        id={`${template.id}-notes`}
                        placeholder="e.g. Focus on tempo, keep core tight..."
                        value={template.notes}
                        onChange={(e) =>
                          onUpdateTemplate(template.id, { notes: e.target.value })
                        }
                        className="mt-1 min-h-[60px] cursor-text rounded-xl bg-primary/5 border-primary/5 focus:border-primary/20 transition-all text-sm resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button
                    data-testid={`change-routine-exercise-${templateIndex}`}
                    variant="outline"
                    size="sm"
                    onClick={() => onChangeExercise(template.id)}
                    className="rounded-xl border-border/60 hover:bg-muted font-bold transition-all text-xs"
                  >
                    <Pencil className="mr-2 h-3 w-3" />
                    Change
                  </Button>
                  <Button
                    data-testid={`remove-routine-template-${templateIndex}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveTemplate(template.id)}
                    className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive font-bold transition-all text-xs"
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    Remove
                  </Button>
                </div>
              )}
            </div>

            <div className={canEdit ? "space-y-3" : "flex flex-wrap gap-2 mt-2"}>
              {template.set_templates.map((setTemplate, setIndex) =>
                canEdit ? (
                  (() => {
                    const prefersTimeByDefault = prefersDurationForIntensityUnit(
                      setTemplate.intensity_unit_id,
                    );
                    const setValueMode = resolveSetValueMode(
                      setTemplate,
                      prefersTimeByDefault,
                    );
                    const isTimeMode = setValueMode === "time";
                    const durationDraftKey = `${template.id}-${setTemplate.id}`;
                    const durationDraft =
                      durationDrafts[durationDraftKey] ??
                      formatDurationInputValue(setTemplate.duration_seconds);

                    return (
                      <div
                        key={setTemplate.id}
                        data-testid={`routine-template-${templateIndex}-set-${setIndex}`}
                        className="rounded-xl border border-border/30 bg-background/50 p-4 shadow-sm backdrop-blur-sm"
                      >
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border/10 pb-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-6 w-6 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-black border border-primary/10">
                              {setIndex + 1}
                            </div>
                            <div className="min-w-0 break-words text-xs font-black uppercase tracking-widest opacity-80">
                              {formatSetSummary(setTemplate)}
                            </div>
                          </div>
                          <Button
                            data-testid={`remove-routine-set-${templateIndex}-${setIndex}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveSet(template.id, setTemplate.id)}
                            className="h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-bold transition-all text-[10px] uppercase tracking-wider"
                          >
                            <Trash2 className="mr-1.5 h-3 w-3" />
                            Remove
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="grid gap-1.5">
                            <label
                              htmlFor={`${template.id}-${setTemplate.id}-${isTimeMode ? "time" : "reps"}`}
                              className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1"
                            >
                              {isTimeMode ? "Time" : "Reps"}
                            </label>
                            {isTimeMode ? (
                              <Input
                                id={`${template.id}-${setTemplate.id}-time`}
                                data-testid={`routine-set-time-${templateIndex}-${setIndex}`}
                                type="text"
                                inputMode="numeric"
                                value={durationDraft}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  if (!canUpdateDurationInputValue(nextValue)) {
                                    return;
                                  }

                                  setDurationDrafts((current) => ({
                                    ...current,
                                    [durationDraftKey]: nextValue,
                                  }));

                                  const parsedDuration = parseDurationInputValue(
                                    nextValue,
                                  );
                                  if (parsedDuration == null) {
                                    return;
                                  }

                                  onUpdateSet(template.id, setTemplate.id, {
                                    reps: null,
                                    duration_seconds: parsedDuration,
                                  });
                                }}
                                onBlur={() => {
                                  const parsedDuration = parseDurationInputValue(
                                    durationDraft,
                                  );

                                  if (durationDraft.trim() === "") {
                                    onUpdateSet(template.id, setTemplate.id, {
                                      reps: null,
                                      duration_seconds: null,
                                    });
                                    return;
                                  }

                                  if (parsedDuration == null) {
                                    setDurationDrafts((current) => ({
                                      ...current,
                                      [durationDraftKey]:
                                        formatDurationInputValue(
                                          setTemplate.duration_seconds,
                                        ),
                                    }));
                                    return;
                                  }

                                  onUpdateSet(template.id, setTemplate.id, {
                                    reps: null,
                                    duration_seconds: parsedDuration,
                                  });
                                }}
                                placeholder="00:00"
                                className="h-10 rounded-xl bg-primary/5 border-primary/5 focus:border-primary/20 transition-all font-semibold text-center"
                              />
                            ) : (
                              <Input
                                id={`${template.id}-${setTemplate.id}-reps`}
                                data-testid={`routine-set-reps-${templateIndex}-${setIndex}`}
                                type="number"
                                min="0"
                                step="1"
                                value={setTemplate.reps ?? ""}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  onUpdateSet(template.id, setTemplate.id, {
                                    reps:
                                      nextValue.trim() === ""
                                        ? null
                                        : Number.parseInt(nextValue, 10),
                                    duration_seconds: null,
                                  });
                                }}
                                placeholder="0"
                                className="h-10 rounded-xl bg-primary/5 border-primary/5 focus:border-primary/20 transition-all font-semibold text-center"
                              />
                            )}
                          </div>

                          <div className="grid gap-1.5">
                            <label
                              htmlFor={`${template.id}-${setTemplate.id}-intensity`}
                              className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1"
                            >
                              Intensity
                            </label>
                            <Input
                              id={`${template.id}-${setTemplate.id}-intensity`}
                              data-testid={`routine-set-intensity-${templateIndex}-${setIndex}`}
                              inputMode="decimal"
                              value={
                                setTemplate.intensity != null
                                  ? formatDecimal(setTemplate.intensity)
                                  : ""
                              }
                              onChange={(event) =>
                                onUpdateSet(template.id, setTemplate.id, {
                                  intensity: parseDecimalInput(event.target.value),
                                })
                              }
                              placeholder="0.0"
                              className="h-10 rounded-xl bg-primary/5 border-primary/5 focus:border-primary/20 transition-all font-semibold text-center"
                            />
                          </div>

                          <div className="grid gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">
                              Unit
                            </span>
                            <Button
                              data-testid={`routine-set-unit-${templateIndex}-${setIndex}`}
                              variant="outline"
                              className="h-10 rounded-xl bg-primary/5 border-primary/5 hover:border-primary/20 transition-all font-semibold text-xs justify-between"
                              onClick={() => onSelectUnit(template.id, setTemplate.id)}
                            >
                              <span className="truncate">
                                {setTemplate.intensity_unit
                                  ? setTemplate.intensity_unit.abbreviation
                                  : "---"}
                              </span>
                              <span className="text-[8px] opacity-40 uppercase">
                                Change
                              </span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div
                    key={setTemplate.id}
                    className="flex max-w-full items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 shadow-lg shadow-primary/5 backdrop-blur-sm"
                  >
                    <span className="text-[10px] font-black text-primary opacity-40">{setIndex + 1}</span>
                    <span className="min-w-0 break-words text-xs font-bold tracking-tight italic text-foreground opacity-90">
                      {formatSetSummary(setTemplate)}
                    </span>
                  </div>
                ),
              )}
            </div>

            {canEdit && (
              <Button
                data-testid={`add-routine-set-${templateIndex}`}
                variant="secondary"
                size="sm"
                className="mt-4 w-full h-10 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/20 transition-all font-bold text-xs uppercase tracking-widest"
                onClick={() => onAddSet(template.id)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Set
              </Button>
            )}
          </div>
        ))
      )}
      </CardContent>
    </Card>
  );
};
