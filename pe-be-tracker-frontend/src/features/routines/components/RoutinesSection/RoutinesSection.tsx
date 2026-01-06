import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useGuestStore, useAuthStore, GuestRoutine } from "@/stores";
import { getRoutines } from "@/features/routines/api";
import { RoutineQuickStartCard } from "@/features/routines/components";
import { Button } from "@/shared/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/shared/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoutinesSectionProps {
  onStartWorkout: (routine: GuestRoutine) => void;
}

export const RoutinesSection: React.FC<RoutinesSectionProps> = ({
  onStartWorkout,
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestData = useGuestStore();

  // Fetch routines from backend for authenticated users
  const { data: serverRoutines = [], isLoading } = useQuery({
    queryKey: ["routines", "quickstart", 2],
    queryFn: async () => {
      const result = await getRoutines("createdAt", 0, 2);
      return result.data;
    },
    enabled: isAuthenticated,
  });

  // NOTE: Guest data uses 'routines' field.
  const routines: GuestRoutine[] = isAuthenticated
    ? Array.isArray(serverRoutines)
      ? serverRoutines.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        description: r.description,
        exercises: (r.exercise_templates || []).map((t: any) => ({
          id: String(t.id),
          exercise_type_id: String(t.exercise_type_id),
          exercise_type: t.exercise_type
            ? {
              id: String(t.exercise_type.id),
              name: t.exercise_type.name,
              description: t.exercise_type.description || "",
              default_intensity_unit:
                t.exercise_type.default_intensity_unit,
              times_used: t.exercise_type.times_used,
            }
            : {
              id: String(t.exercise_type_id),
              name: "Unknown Exercise",
              description: "",
              default_intensity_unit: 1,
              times_used: 0,
            },
          sets: (t.set_templates || []).map((s: any) => ({
            id: String(s.id),
            reps: s.reps ?? null,
            intensity: s.intensity ?? null,
            intensity_unit_id: s.intensity_unit_id,
            rest_time_seconds: null,
          })),
          notes: null,
        })),
        created_at: r.created_at,
        updated_at: r.updated_at,
      }))
      : []
    : Array.isArray(guestData.routines)
      ? guestData.routines
      : [];

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-muted-foreground text-lg font-semibold">
            Quick Start Routines
          </h2>
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
      <Accordion type="single" collapsible>
        <AccordionItem value="quick-start-routines">
          <AccordionPrimitive.Header className="flex" asChild>
            <h2 className="flex">
              <AccordionPrimitive.Trigger
                className={cn(
                  "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-center justify-start gap-2 rounded-md py-0 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
                )}
              >
                <span className="text-muted-foreground text-lg font-semibold">
                  Quick Start Routines
                </span>
                <ChevronDown className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
              </AccordionPrimitive.Trigger>
            </h2>
          </AccordionPrimitive.Header>
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
