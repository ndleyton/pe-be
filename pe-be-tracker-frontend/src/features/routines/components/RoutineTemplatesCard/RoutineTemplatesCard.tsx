import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  formatSetSummary,
  type RoutineEditorSet,
  type RoutineEditorTemplate,
} from "@/features/routines/lib/routineEditor";
import { parseDecimalInput } from "@/utils/format";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

type RoutineTemplatesCardProps = {
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
  editorTemplates,
  onAddExercise,
  onAddSet,
  onChangeExercise,
  onRemoveSet,
  onRemoveTemplate,
  onSelectUnit,
  onUpdateSet,
}: RoutineTemplatesCardProps) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between gap-4">
        <div>
          <CardTitle>Exercise Templates</CardTitle>
          <CardDescription>
            Build the routine the way `WorkoutPage` builds a live workout, but
            without timer or completion state.
          </CardDescription>
        </div>
        <Button
          data-testid="add-routine-exercise-button"
          onClick={onAddExercise}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Exercise
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {editorTemplates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No exercise templates yet. Add one to start building the routine.
        </div>
      ) : (
        editorTemplates.map((template, templateIndex) => (
          <div
            key={template.id}
            data-testid={`routine-template-${templateIndex}`}
            className="rounded-lg border bg-muted/30 p-4"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold">
                  {templateIndex + 1}.{" "}
                  {template.exercise_type?.name ?? "Select exercise"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {template.set_templates.length} set
                  {template.set_templates.length !== 1 ? "s" : ""} in this
                  template
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  data-testid={`change-routine-exercise-${templateIndex}`}
                  variant="outline"
                  size="sm"
                  onClick={() => onChangeExercise(template.id)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Change Exercise
                </Button>
                <Button
                  data-testid={`remove-routine-template-${templateIndex}`}
                  variant="destructive"
                  size="sm"
                  onClick={() => onRemoveTemplate(template.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {template.set_templates.map((setTemplate, setIndex) => (
                <div
                  key={setTemplate.id}
                  data-testid={`routine-template-${templateIndex}-set-${setIndex}`}
                  className="rounded-md border bg-background p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">Set {setIndex + 1}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatSetSummary(setTemplate)}
                      </div>
                    </div>
                    <Button
                      data-testid={`remove-routine-set-${templateIndex}-${setIndex}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveSet(template.id, setTemplate.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove Set
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="grid gap-2">
                      <label
                        htmlFor={`${template.id}-${setTemplate.id}-reps`}
                        className="text-sm font-medium"
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
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          onUpdateSet(template.id, setTemplate.id, {
                            reps:
                              nextValue.trim() === ""
                                ? null
                                : Number.parseInt(nextValue, 10),
                          });
                        }}
                        placeholder="e.g. 10"
                      />
                    </div>

                    <div className="grid gap-2">
                      <label
                        htmlFor={`${template.id}-${setTemplate.id}-intensity`}
                        className="text-sm font-medium"
                      >
                        Intensity
                      </label>
                      <Input
                        id={`${template.id}-${setTemplate.id}-intensity`}
                        data-testid={`routine-set-intensity-${templateIndex}-${setIndex}`}
                        inputMode="decimal"
                        value={setTemplate.intensity ?? ""}
                        onChange={(event) =>
                          onUpdateSet(template.id, setTemplate.id, {
                            intensity: parseDecimalInput(event.target.value),
                          })
                        }
                        placeholder="e.g. 135"
                      />
                    </div>

                    <div className="grid gap-2">
                      <span className="text-sm font-medium">
                        Intensity Unit
                      </span>
                      <Button
                        data-testid={`routine-set-unit-${templateIndex}-${setIndex}`}
                        variant="outline"
                        className="justify-start"
                        onClick={() => onSelectUnit(template.id, setTemplate.id)}
                      >
                        {setTemplate.intensity_unit
                          ? `${setTemplate.intensity_unit.abbreviation} - ${setTemplate.intensity_unit.name}`
                          : "Select unit"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              data-testid={`add-routine-set-${templateIndex}`}
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => onAddSet(template.id)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Set
            </Button>
          </div>
        ))
      )}
    </CardContent>
  </Card>
);
