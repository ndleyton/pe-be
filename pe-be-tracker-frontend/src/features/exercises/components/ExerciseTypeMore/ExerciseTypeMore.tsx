
import { useQuery } from "@tanstack/react-query";
import { getIntensityUnits, IntensityUnit } from "@/features/exercises/api";
import { useAuthStore } from "@/stores";
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui";
import { Trash2 } from "lucide-react";

// Guest intensity unit type (simplified)
interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

interface ExerciseTypeMoreProps {
  currentIntensityUnit?: IntensityUnit | GuestIntensityUnit;
  onIntensityUnitChange: (unit: IntensityUnit | GuestIntensityUnit) => void;
  onExerciseDelete: () => void;
  disableExerciseDelete?: boolean;
  onClose?: () => void;
}

const ExerciseTypeMore = ({
  currentIntensityUnit,
  onIntensityUnitChange,
  onExerciseDelete,
  disableExerciseDelete = false,
  onClose,
}: ExerciseTypeMoreProps) => {
  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const {
    data: serverIntensityUnits = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["intensityUnits"],
    queryFn: getIntensityUnits,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // For guest mode, use hardcoded intensity units (match backend)
  const guestIntensityUnits: GuestIntensityUnit[] = [
    { id: 1, name: "Kilograms", abbreviation: "kg" },
    { id: 2, name: "Pounds", abbreviation: "lbs" },
    { id: 5, name: "Bodyweight", abbreviation: "BW" },
  ];

  const intensityUnits = isAuthenticated
    ? serverIntensityUnits
    : guestIntensityUnits;

  return (
    <div className="space-y-4 p-4">
      {/* Intensity Unit Selection */}
      <div>
        <h4 className="text-foreground mb-3 text-sm font-medium">
          Intensity Unit
        </h4>

        {isAuthenticated && isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-muted h-10 animate-pulse rounded-lg"
              />
            ))}
          </div>
        )}

        {isAuthenticated && error && (
          <p className="text-destructive text-center text-sm">
            Failed to load intensity units.
          </p>
        )}

        {(!isAuthenticated || (!isLoading && !error)) && (
          <div className="grid grid-cols-2 gap-2">
            {intensityUnits.map((unit) => (
              <button
                key={unit.id}
                onClick={() => onIntensityUnitChange(unit)}
                className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                  currentIntensityUnit?.id === unit.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-accent text-muted-foreground"
                }`}
                aria-label={`Select ${unit.name} (${unit.abbreviation})`}
              >
                <span className="font-medium">{unit.abbreviation}</span>
                <span className="block text-xs opacity-75">{unit.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete Exercise Section */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                disabled={disableExerciseDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Exercise
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this exercise? This will also
                  delete all associated sets and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={disableExerciseDelete}
                  onClick={onExerciseDelete}
                >
                  Delete Exercise
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {onClose && <Button onClick={onClose}>Close</Button>}
        </div>
      </div>
    </div>
  );
};

export default ExerciseTypeMore;
