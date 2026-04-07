import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getExerciseTypes, createExerciseType, type ExerciseType } from "@/features/exercises/api";
import { useGuestStore, useAuthStore, GuestExerciseType } from "@/stores";
import axios from "axios";
import { MUSCLE_DISPLAY_LIMIT } from "@/shared/constants";
import { EXERCISE_TYPE_MODAL_INITIAL_LIMIT } from "@/features/exercises/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Search, X, Plus, Info, Dumbbell } from "lucide-react";

interface ExerciseTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exerciseType: ExerciseType | GuestExerciseType) => void;
}

// Type guard to check if an exercise type has muscles property
const hasMusclesProperty = (
  exerciseType: ExerciseType | GuestExerciseType,
): exerciseType is ExerciseType & {
  muscles: Array<{ id: number; name: string }>;
} => {
  return "muscles" in exerciseType && Array.isArray(exerciseType.muscles);
};

const ExerciseTypeModal = ({
  isOpen,
  onClose,
  onSelect,
}: ExerciseTypeModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();

  const {
    data: serverExerciseTypesResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["exerciseTypes"],
    queryFn: () => getExerciseTypes("usage", undefined, EXERCISE_TYPE_MODAL_INITIAL_LIMIT),
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Use guest data if not authenticated, server data if authenticated
  const exerciseTypes = isAuthenticated
    ? Array.isArray(serverExerciseTypesResponse?.data)
      ? serverExerciseTypesResponse.data
      : []
    : Array.isArray(guestData.exerciseTypes)
      ? guestData.exerciseTypes
      : [];

  const createMutation = useMutation({
    mutationFn: createExerciseType,
    onSuccess: (newExerciseType) => {
      queryClient.invalidateQueries({ queryKey: ["exerciseTypes"] });
      handleSelect(newExerciseType);
    },
    onError: (err: unknown) => {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 400 &&
        typeof err.response.data?.detail === "string" &&
        err.response.data.detail.toLowerCase().includes("already exists")
      ) {
        // Backend indicates the type already exists — select it instead of showing an error
        const existing = exerciseTypes.find(
          (t: ExerciseType | GuestExerciseType) =>
            t.name.toLowerCase() === searchTerm.toLowerCase(),
        );
        if (existing) {
          handleSelect(existing);
          // No need to show an error since we handled it gracefully
          return;
        }
      }
    },
  });

  const filteredExerciseTypes = useMemo(() => {
    if (!searchTerm.trim()) return exerciseTypes;
    const term = searchTerm.toLowerCase().trim();
    return exerciseTypes.filter(
      (type: ExerciseType | GuestExerciseType) =>
        type.name.toLowerCase().includes(term) ||
        (type.description && type.description.toLowerCase().includes(term)),
    );
  }, [exerciseTypes, searchTerm]);

  const showCreateButton =
    searchTerm.trim() && filteredExerciseTypes.length === 0;

  const createInFlight = useRef(false);

  const handleSelect = (exerciseType: ExerciseType | GuestExerciseType) => {
    if (isAuthenticated) {
      // Optimistically update the times_used count in the cache for server data
      queryClient.setQueryData(
        ["exerciseTypes"],
        (
          oldData:
            | { data: ExerciseType[]; next_cursor?: number | null }
            | undefined,
        ) => {
          if (!oldData || !oldData.data) return oldData;

          const updatedTypes = oldData.data.map((type) =>
            type.id === exerciseType.id
              ? { ...type, times_used: type.times_used + 1 }
              : type,
          );

          // Re-sort by times_used DESC, then by name ASC to maintain the expected order
          const sortedTypes = updatedTypes.sort((a, b) => {
            if (a.times_used !== b.times_used) {
              return b.times_used - a.times_used; // DESC
            }
            return a.name.localeCompare(b.name); // ASC
          });

          return {
            ...oldData,
            data: sortedTypes,
          };
        },
      );
    } else {
      // Update guest data times_used count
      guestActions.updateExerciseType(exerciseType.id as string, {
        times_used: exerciseType.times_used + 1,
      });
    }

    onSelect(exerciseType);
  };

  const handleCreateExerciseType = () => {
    if (createInFlight.current) return; // ignore duplicate clicks while pending
    const trimmedName = searchTerm.trim();
    if (!trimmedName) return;

    createInFlight.current = true;

    // Avoid creating duplicates — if a type with the same name (case-insensitive) already exists, reuse it
    const existingType = exerciseTypes.find(
      (type: ExerciseType | GuestExerciseType) =>
        type.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (existingType) {
      handleSelect(existingType);
      createInFlight.current = false;
      return;
    }

    // Heuristic for default intensity unit
    const cardioKeywords = ["walking", "running", "cycling", "swimming", "treadmill", "rowing", "elliptical", "jogging"];
    const isCardio = cardioKeywords.some(keyword => trimmedName.toLowerCase().includes(keyword));
    const defaultUnitId = isCardio ? 3 : 1; // 3 = km/h, 1 = kg

    if (isAuthenticated) {
      createMutation.mutate(
        {
          name: trimmedName,
          description: "Custom exercise",
          default_intensity_unit: defaultUnitId,
        },
        {
          onSettled: () => {
            createInFlight.current = false;
          },
        },
      );
    } else {
      const newExerciseTypeId = guestActions.addExerciseType({
        name: trimmedName,
        description: "Custom exercise",
        default_intensity_unit: defaultUnitId,
      });

      const newExerciseType = guestData.exerciseTypes.find(
        (et) => et.id === newExerciseTypeId,
      );
      if (newExerciseType) {
        handleSelect(newExerciseType);
        createInFlight.current = false;
      }
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && filteredExerciseTypes.length > 0) {
      handleSelect(filteredExerciseTypes[0]);
    } else if (e.key === "Escape") {
      setSearchTerm("");
    }
  };

  const SkeletonCard = () => (
    <div className="bg-card/40 border-border/40 animate-pulse rounded-2xl border p-4">
      <div className="flex items-center space-x-4">
        <div className="bg-muted h-12 w-12 rounded-xl"></div>
        <div className="flex-1">
          <div className="bg-muted mb-2 h-4 w-1/2 rounded"></div>
          <div className="bg-muted h-3 w-3/4 rounded"></div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isAuthenticated && isLoading) {
      return (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      );
    }

    if (isAuthenticated && error) {
      return (
        <div className="py-12 text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-destructive text-2xl text-center">⚠</span>
          </div>
          <h4 className="text-foreground mb-2 font-bold text-lg">
            Connection Error
          </h4>
          <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
            Failed to load calculations. Please try again.
          </p>
        </div>
      );
    }

    if (exerciseTypes.length === 0) {
      return (
        <div className="py-12 text-center">
          <div className="bg-muted/50 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Dumbbell className="text-muted-foreground h-8 w-8" />
          </div>
          <h4 className="text-foreground mb-2 font-bold text-lg">
            No Exercises
          </h4>
          <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
            {isAuthenticated
              ? "Your gym library is currently empty."
              : "Default exercise types will be initialized soon."}
          </p>
        </div>
      );
    }

    if (searchTerm.trim() && filteredExerciseTypes.length === 0) {
      return (
        <div className="py-12 text-center">
          <div className="bg-primary/5 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Search className="text-primary/40 h-8 w-8" />
          </div>
          <h4 className="text-foreground mb-1 font-bold text-lg">No matches</h4>
          <p className="text-muted-foreground text-sm px-4">
            Create &quot;{searchTerm.trim()}&quot; using the button above.
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-3 p-1">
        {filteredExerciseTypes.map(
          (exerciseType: ExerciseType | GuestExerciseType) => (
            <button
              key={exerciseType.id}
              onClick={() => handleSelect(exerciseType)}
              className="group relative flex w-full items-center space-x-4 overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-4 text-left transition-all hover:scale-[1.01] hover:bg-accent/60 hover:border-primary/30 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {/* Subtle background glow on hover */}
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary font-bold text-xl shadow-inner group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-tr from-primary/30 to-transparent group-hover:opacity-0 transition-opacity" />
                <span className="relative z-10">{exerciseType.name.charAt(0)}</span>
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-foreground font-bold text-base group-hover:text-primary transition-colors">
                    {exerciseType.name}
                  </h4>
                </div>

                <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs font-medium leading-normal opacity-70 group-hover:opacity-100">
                  {exerciseType.description || "No description provided."}
                </p>

                {hasMusclesProperty(exerciseType) &&
                  exerciseType.muscles.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 grayscale-[0.5] group-hover:grayscale-0 transition-all">
                      {exerciseType.muscles
                        .slice(0, MUSCLE_DISPLAY_LIMIT)
                        .map((muscle) => (
                          <span
                            key={muscle.id}
                            className="inline-flex items-center rounded-lg bg-secondary/80 px-2 py-0.5 text-[10px] font-bold text-secondary-foreground border border-border/30"
                          >
                            {muscle.name}
                          </span>
                        ))}
                      {exerciseType.muscles.length > MUSCLE_DISPLAY_LIMIT && (
                        <span className="inline-flex items-center rounded-lg bg-secondary/50 px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border/20">
                          +{exerciseType.muscles.length - MUSCLE_DISPLAY_LIMIT}
                        </span>
                      )}
                    </div>
                  )}
              </div>

              <div className="text-muted-foreground opacity-30 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary">
                <Plus className="h-5 w-5" />
              </div>
            </button>
          ),
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85vh] sm:max-w-xl border-border/40 p-0 overflow-hidden flex flex-col"
        hideOverlay={true}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold tracking-tight">Select Exercise Type</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative group">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="text-muted-foreground group-focus-within:text-primary h-5 w-5 transition-colors" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search exercise types..."
              disabled={isAuthenticated && createMutation.isPending}
              className="border-border/50 bg-accent/30 text-foreground placeholder-muted-foreground/60 focus:ring-primary/20 block w-full rounded-2xl border py-3 pr-12 pl-12 focus:border-primary/30 focus:ring-4 focus:outline-none disabled:opacity-50 transition-all font-medium"
            />

            <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
              {searchTerm && !showCreateButton && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all"
                  title="Clear search"
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              {showCreateButton && (
                <button
                  onClick={handleCreateExerciseType}
                  disabled={isAuthenticated && createMutation.isPending}
                  className="flex items-center gap-1.5 bg-primary px-3 py-1.5 rounded-xl text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  title={`Create "${searchTerm.trim()}"`}
                >
                  {isAuthenticated && createMutation.isPending ? (
                    <Plus className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create New
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {isAuthenticated && createMutation.isError && (
            <p className="text-destructive mt-3 text-xs font-semibold flex items-center gap-1 bg-destructive/5 p-2 rounded-lg">
              <Info className="h-3 w-3" />
              Failed to create exercise type. Please try again.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 scrollbar-thin scrollbar-thumb-border/20">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseTypeModal;
