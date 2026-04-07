import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  formatSetSummary,
  type RoutineEditorSet,
  type RoutineEditorTemplate,
} from "@/features/routines/lib/routineEditor";
import { formatDecimal, parseDecimalInput } from "@/utils/format";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
}: RoutineTemplatesCardProps) => (
  <Card className="bg-card/80 border-border/40 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md overflow-hidden">
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏋️</span>
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
              Exercise Sequence
            </h4>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Templates Structure</CardTitle>
        </div>
        {canEdit && (
          <Button
            data-testid="add-routine-exercise-button"
            onClick={onAddExercise}
            size="sm"
            className="rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-bold"
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
            className="rounded-2xl border border-border/40 bg-primary/5 p-5 shadow-sm transition-all hover:bg-primary/[0.07]"
          >
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background border border-border/40 text-xl font-black shadow-inner">
                  {templateIndex + 1}
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    {template.exercise_type?.name ?? "Missing Selection"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {template.set_templates.length} set{template.set_templates.length !== 1 ? "s" : ""}
                    </span>
                  </div>
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

            <div className="space-y-3">
              {template.set_templates.map((setTemplate, setIndex) => (
                <div
                  key={setTemplate.id}
                  data-testid={`routine-template-${templateIndex}-set-${setIndex}`}
                  className="rounded-xl border border-border/30 bg-background/50 p-4 shadow-sm backdrop-blur-sm"
                >
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/10 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-black border border-primary/10">
                        {setIndex + 1}
                      </div>
                      <div className="text-xs font-black uppercase tracking-widest opacity-80">
                        {formatSetSummary(setTemplate)}
                      </div>
                    </div>
                    {canEdit && (
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
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-1.5">
                      <label
                        htmlFor={`${template.id}-${setTemplate.id}-reps`}
                        className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1"
                      >
                        Reps
                      </label>
                      <Input
                        id={`${template.id}-${setTemplate.id}-reps`}
                        data-testid={`routine-set-reps-${templateIndex}-${setIndex}`}
                        type="number"
                        min="0"
                        step="1"
                        value={setTemplate.reps ?? ""}
                        readOnly={!canEdit}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          onUpdateSet(template.id, setTemplate.id, {
                            reps:
                              nextValue.trim() === ""
                                ? null
                                : Number.parseInt(nextValue, 10),
                          });
                        }}
                        placeholder="0"
                        className="h-10 rounded-xl bg-primary/5 border-primary/5 focus:border-primary/20 transition-all font-semibold text-center"
                      />
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
                        readOnly={!canEdit}
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
                      {canEdit ? (
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
                          <span className="text-[8px] opacity-40 uppercase">Change</span>
                        </Button>
                      ) : (
                        <div className="h-10 flex items-center justify-center bg-primary/5 rounded-xl border border-transparent text-xs font-semibold">
                          {setTemplate.intensity_unit
                            ? setTemplate.intensity_unit.abbreviation
                            : "---"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {canEdit && (
              <Button
                data-testid={`add-routine-set-${templateIndex}`}
                variant="secondary"
                size="sm"
                className="mt-4 w-full h-10 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all font-bold text-xs uppercase tracking-widest"
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
