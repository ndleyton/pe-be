import type { MouseEvent } from "react";

import { ChevronRight, ExternalLink, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";

import type { Exercise, IntensityUnit } from "@/features/exercises/api";
import type { GuestIntensityUnit } from "@/features/exercises/lib/intensityUnits";
import { ExerciseTypeMore } from "../ExerciseTypeMore";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";
import { cn } from "@/lib/utils";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui";

const preloadExerciseTypeDetailsPage = createIntentPreload(() =>
  import("@/features/exercises/pages"),
);

type ExerciseRowHeaderProps = {
  currentIntensityUnit: IntensityUnit | GuestIntensityUnit;
  exercise: Exercise;
  exerciseNotesValue: string;
  exerciseSettingsOpen: boolean;
  isUnsavedExercise: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onExerciseDelete: () => void | Promise<void>;
  onExerciseSettingsOpenChange: (open: boolean) => void;
  onIntensityUnitChange: (unit: IntensityUnit | GuestIntensityUnit) => void;
};

export const ExerciseRowHeader = ({
  currentIntensityUnit,
  exercise,
  exerciseNotesValue,
  exerciseSettingsOpen,
  isUnsavedExercise,
  isExpanded,
  onToggleExpand,
  onExerciseDelete,
  onExerciseSettingsOpenChange,
  onIntensityUnitChange,
}: ExerciseRowHeaderProps) => {
  const showExerciseTypeDetailsLink =
    typeof exercise.exercise_type.id === "number" &&
    (exercise.exercise_type.status ?? "released") === "released";

  const handleHeaderClick = (
    event: MouseEvent<HTMLDivElement>,
  ) => {
    const target = event.target;

    if (
      target instanceof Element &&
      target.closest(
        '[data-slot="dialog-content"], [data-slot="dialog-overlay"]',
      )
    ) {
      return;
    }

    onToggleExpand();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-center justify-between transition-colors rounded-lg",
        "cursor-pointer select-none"
      )}
      onClick={handleHeaderClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleExpand();
        }
      }}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? "Hide details" : "Show details"}
      title="Click to expand/collapse"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0 transition-colors duration-300",
            isExpanded
              ? "bg-rose-500 text-primary-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform duration-300",
              isExpanded ? "rotate-90" : "rotate-0",
            )}
          />
        </div>
        <div className="flex flex-col justify-center items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-foreground font-semibold text-left">
              {exercise.exercise_type.name}
            </h3>
            {showExerciseTypeDetailsLink && (
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground h-6 w-6 p-0 dark:hover:bg-gray-700"
                asChild
                onMouseEnter={preloadExerciseTypeDetailsPage}
                onTouchStart={preloadExerciseTypeDetailsPage}
                onFocus={preloadExerciseTypeDetailsPage}
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  to={`/exercise-types/${exercise.exercise_type.id}`}
                  aria-label={`View details for ${exercise.exercise_type.name}`}
                  title="View exercise details"
                >
                  <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </Link>
              </Button>
            )}
          </div>
          <div
            data-testid="ghost-placeholder-wrapper"
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isExpanded ? "max-h-0 opacity-0 translate-y-2 pointer-events-none" : "max-h-6 opacity-100 translate-y-0"
            )}
          >
            <p
              className="text-xs text-left text-muted-foreground opacity-60 truncate w-full max-w-[200px] sm:max-w-[300px] mt-0.5 ml-0.5"
              aria-hidden="true"
            >
              {exerciseNotesValue?.trim() ? exerciseNotesValue : "+ Add notes"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 relative z-10">
        <Dialog
          open={exerciseSettingsOpen}
          onOpenChange={onExerciseSettingsOpenChange}
        >
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exercise Settings</DialogTitle>
              <DialogDescription>
                Adjust the active intensity unit or delete this exercise.
              </DialogDescription>
            </DialogHeader>
            <ExerciseTypeMore
              currentIntensityUnit={currentIntensityUnit}
              onIntensityUnitChange={onIntensityUnitChange}
              onExerciseDelete={onExerciseDelete}
              disableExerciseDelete={isUnsavedExercise}
              onClose={() => onExerciseSettingsOpenChange(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
