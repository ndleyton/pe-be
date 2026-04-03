import React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Routine } from "@/features/routines/types";
import { useAuthStore } from "@/stores";
import { getRoutines } from "@/features/routines/api";
import { RoutineQuickStartCard } from "@/features/routines/components";
import { Button } from "@/shared/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface RoutinesSectionProps {
  onStartWorkout: (routine: Routine) => void;
  autoOpen?: boolean;
}

const QUICK_START_ROUTINES_VALUE = "quick-start-routines";

export const RoutinesSection: React.FC<RoutinesSectionProps> = ({
  onStartWorkout,
  autoOpen = false,
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [accordionValue, setAccordionValue] = React.useState("");
  const [hasAutoOpened, setHasAutoOpened] = React.useState(false);

  const { data: routines = [], isLoading } = useQuery({
    queryKey: ["routines", "quickstart", 2, isAuthenticated],
    queryFn: async () => {
      const result = await getRoutines("createdAt", 0, 2);
      return result.data;
    },
  });

  React.useEffect(() => {
    if (!autoOpen) {
      setHasAutoOpened(false);
      return;
    }

    if (isLoading || routines.length === 0 || hasAutoOpened) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAccordionValue(QUICK_START_ROUTINES_VALUE);
      setHasAutoOpened(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [autoOpen, hasAutoOpened, isLoading, routines.length]);

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
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  aria-label="Browse all routines"
                >
                  <Link to="/routines">
                    <ChevronRight className="text-muted-foreground h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
