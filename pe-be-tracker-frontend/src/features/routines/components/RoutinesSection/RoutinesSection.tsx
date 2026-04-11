import React from "react";
import { useQuery } from "@tanstack/react-query";
import type { RoutineSummary } from "@/features/routines/types";
import { useAuthStore } from "@/stores";
import { getRoutines } from "@/features/routines/api";
import { RoutineQuickStartCard } from "@/features/routines/components";
import { Button } from "@/shared/components/ui/button";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";

const preloadRoutinesPage = createIntentPreload(() =>
  import("@/features/routines/pages/RoutinesPage"),
);

interface RoutinesSectionProps {
  onStartWorkout: (routine: RoutineSummary) => void;
  autoOpen?: boolean;
}

const QUICK_START_ROUTINES_CONTENT_ID = "quick-start-routines";

export const RoutinesSection: React.FC<RoutinesSectionProps> = ({
  onStartWorkout,
  autoOpen = false,
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isExpanded, setIsExpanded] = React.useState(false);

  const { data: routines = [], isLoading } = useQuery({
    queryKey: ["routines", "quickstart", 3, isAuthenticated],
    queryFn: async () => {
      const result = await getRoutines("createdAt", 0, 3);
      return result.data;
    },
  });

  React.useEffect(() => {
    if (autoOpen && routines.length > 0) {
      setIsExpanded(true);
    }
  }, [autoOpen, routines.length]);

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-muted-foreground text-lg font-semibold">
            Quick Start Routines
          </h3>
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (routines.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 w-full">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={QUICK_START_ROUTINES_CONTENT_ID}
            onClick={() => setIsExpanded((current) => !current)}
            className="focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-start justify-between gap-4 rounded-md py-0 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px]"
          >
            <h3 className="text-muted-foreground text-lg font-semibold">
              Quick Start Routines
            </h3>
            <ChevronDown
              className={`text-muted-foreground size-4 shrink-0 translate-y-0.5 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
          <div
            id={QUICK_START_ROUTINES_CONTENT_ID}
            hidden={!isExpanded}
            className="overflow-hidden text-sm"
          >
            <div className="pt-0 pb-4">
              <div className="w-full px-1 sm:px-3">
                <div className="w-full min-w-0 overflow-x-auto">
                  <div className="flex flex-nowrap gap-2 py-1">
                    {routines.map((routine) => (
                      <div key={routine.id}>
                        <RoutineQuickStartCard
                          routine={routine}
                          onStartWorkout={onStartWorkout}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Button
          asChild
          size="icon"
          variant="ghost"
          aria-label="Browse all routines"
          className="shrink-0"
          onMouseEnter={preloadRoutinesPage}
          onTouchStart={preloadRoutinesPage}
          onFocus={preloadRoutinesPage}
        >
          <Link to="/routines">
            <ChevronRight className="text-muted-foreground h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
};
