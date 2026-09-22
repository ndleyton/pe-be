import React from "react";
import { useQuery } from "@tanstack/react-query";
import type { RoutineSummary } from "@/features/routines/types";
import { useAuthStore } from "@/stores";
import { getRoutines } from "@/features/routines/api";
import { RoutineQuickStartCard } from "../RoutineQuickStartCard/RoutineQuickStartCard";
import { RoutineQuickStartCardSkeleton } from "../skeletons/RoutinesPageSkeleton";
import { Button } from "@/shared/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";

const preloadRoutinesPage = createIntentPreload(() =>
  import("@/features/routines/pages/RoutinesPage"),
);

interface RoutinesSectionProps {
  onStartWorkout: (routine: RoutineSummary) => void;
  autoOpen?: boolean;
}

const QUICK_START_ROUTINES_VALUE = "quick-start-routines";

export const RoutinesSection: React.FC<RoutinesSectionProps> = ({
  onStartWorkout,
  autoOpen = false,
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [accordionValue, setAccordionValue] = React.useState(
    autoOpen ? QUICK_START_ROUTINES_VALUE : "",
  );

  const { data: routines = [], isLoading } = useQuery({
    queryKey: ["routines", "quickstart", 3, isAuthenticated],
    queryFn: async () => {
      const result = await getRoutines("createdAtAsc", 0, 3);
      return result.data;
    },
  });

  React.useEffect(() => {
    if (autoOpen) {
      setAccordionValue(QUICK_START_ROUTINES_VALUE);
    }
  }, [autoOpen]);

  if (!isLoading && routines.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 w-full" aria-busy={isLoading ? "true" : undefined}>
      <Accordion
        type="single"
        collapsible
        value={accordionValue}
        onValueChange={setAccordionValue}
      >
        <AccordionItem value={QUICK_START_ROUTINES_VALUE}>
          <AccordionTrigger className="justify-start gap-2 py-0">
            <h3 className="text-muted-foreground text-lg font-semibold">
              Quick Start Routines
            </h3>
          </AccordionTrigger>
          <AccordionContent>
            <div className="w-full px-1 sm:px-3">
              <div className="flex w-full items-center gap-2">
                <div className="w-0 min-w-0 flex-1 overflow-x-auto">
                  <div className="flex items-stretch flex-nowrap gap-4 pt-2 pb-8 px-2">
                    {isLoading
                      ? Array.from({ length: 3 }).map((_, index) => (
                          <RoutineQuickStartCardSkeleton
                            key={index}
                            className="w-[18rem] sm:w-80 shrink-0"
                          />
                        ))
                      : routines.map((routine) => (
                          <RoutineQuickStartCard
                            key={routine.id}
                            routine={routine}
                            onStartWorkout={onStartWorkout}
                            className="w-[18rem] sm:w-80 shrink-0"
                          />
                        ))}
                  </div>
                </div>
                {!isLoading && (
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
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
