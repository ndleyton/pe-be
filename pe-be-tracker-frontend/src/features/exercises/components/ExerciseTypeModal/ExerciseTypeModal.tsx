import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getExerciseTypes, createExerciseType, type ExerciseType } from "@/features/exercises/api";
import { useGuestStore, useAuthStore, GuestExerciseType } from "@/stores";
import axios from "axios";
import { truncateWords } from "@/utils/text";
import { MUSCLE_DISPLAY_LIMIT } from "@/shared/constants";

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
    queryFn: () => getExerciseTypes("usage"), // Use usage-based ordering by default
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

    if (isAuthenticated) {
      // Create via API for authenticated users
      createMutation.mutate(
        {
          name: trimmedName,
          description: "Custom exercise",
          default_intensity_unit: 1,
        },
        {
          onSettled: () => {
            createInFlight.current = false;
          },
        },
      );
    } else {
      // Create via guest context for unauthenticated users
      const newExerciseTypeId = guestActions.addExerciseType({
        name: trimmedName,
        description: "Custom exercise",
        default_intensity_unit: 1,
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

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const SkeletonCard = () => (
    <div className="bg-muted/30 animate-pulse rounded-xl p-4">
      <div className="flex items-center space-x-4">
        <div className="bg-muted h-12 w-12 rounded-xl"></div>
        <div className="flex-1">
          <div className="bg-muted mb-2 h-5 w-3/4 rounded-lg"></div>
          <div className="bg-muted h-4 w-full rounded-lg"></div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isAuthenticated && isLoading) {
      return (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      );
    }

    if (isAuthenticated && error) {
      return (
        <div className="py-8 text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-destructive text-2xl">⚠</span>
          </div>
          <h4 className="text-foreground mb-2 font-medium">
            Failed to load exercise types
          </h4>
          <p className="text-muted-foreground text-sm">
            Please try again later
          </p>
        </div>
      );
    }

    if (exerciseTypes.length === 0) {
      return (
        <div className="py-8 text-center">
          <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-muted-foreground text-2xl">💪</span>
          </div>
          <h4 className="text-foreground mb-2 font-medium">
            No exercise types available
          </h4>
          <p className="text-muted-foreground text-sm">
            {isAuthenticated
              ? "Contact support if this persists"
              : "Default exercise types will be created automatically"}
          </p>
        </div>
      );
    }

    if (searchTerm.trim() && filteredExerciseTypes.length === 0) {
      return (
        <div className="py-8 text-center">
          <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-muted-foreground text-2xl">🔍</span>
          </div>
          <h4 className="text-foreground mb-2 font-medium">No results found</h4>
          <p className="text-muted-foreground text-sm">
            Try a different search term or create a new exercise type
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredExerciseTypes.map(
          (exerciseType: ExerciseType | GuestExerciseType) => (
            <div
              key={exerciseType.id}
              onClick={() => handleSelect(exerciseType)}
              className="hover:bg-accent/50 cursor-pointer rounded-xl p-4 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center space-x-4">
                <div className="bg-primary flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-sm">
                  <span className="text-primary-foreground text-lg font-bold">
                    {exerciseType.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-foreground text-base font-semibold">
                      {exerciseType.name}
                    </h4>
                    {exerciseType.times_used > 0 && (
                      <span className="text-muted-foreground whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        {exerciseType.times_used} Used
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {truncateWords(exerciseType.description, 4)}
                  </p>

                  {hasMusclesProperty(exerciseType) &&
                    exerciseType.muscles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {exerciseType.muscles
                          .slice(0, MUSCLE_DISPLAY_LIMIT)
                          .map((muscle) => (
                            <span
                              key={muscle.id}
                              className="focus:ring-ring bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                            >
                              {muscle.name}
                            </span>
                          ))}
                        {exerciseType.muscles.length > MUSCLE_DISPLAY_LIMIT && (
                          <span className="focus:ring-ring bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none">
                            +
                            {exerciseType.muscles.length - MUSCLE_DISPLAY_LIMIT}{" "}
                            more
                          </span>
                        )}
                      </div>
                    )}
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-background flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl transition-all border border-border/40">
        <div className="p-6 pb-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-foreground text-xl font-bold">
              Add Exercise
            </h3>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="mb-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="text-muted-foreground h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search exercise types..."
                disabled={isAuthenticated && createMutation.isPending}
                className="bg-muted/50 text-foreground placeholder-muted-foreground focus:ring-primary/20 block w-full rounded-xl border-none py-3 pr-12 pl-12 transition-all focus:bg-muted/70 focus:ring-4 focus:outline-none disabled:opacity-50 text-base"
              />
              {showCreateButton && (
                <button
                  onClick={handleCreateExerciseType}
                  disabled={isAuthenticated && createMutation.isPending}
                  className="text-secondary hover:text-secondary/80 absolute inset-y-0 right-0 flex items-center pr-3 disabled:cursor-not-allowed disabled:opacity-50"
                  title={`Create "${searchTerm.trim()}"`}
                >
                  {isAuthenticated && createMutation.isPending ? (
                    <svg
                      className="h-5 w-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  )}
                </button>
              )}
              {searchTerm && !showCreateButton && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-3"
                  title="Clear search"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
            {isAuthenticated && createMutation.isError && (
              <p className="text-destructive mt-2 text-sm">
                Failed to create exercise type. Please try again.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseTypeModal;
