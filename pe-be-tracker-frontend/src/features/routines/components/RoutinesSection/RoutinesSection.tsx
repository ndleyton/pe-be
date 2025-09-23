import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGuestStore, useAuthStore, GuestRecipe } from '@/stores';
import { getRoutines } from '@/features/routines/api';
import { RoutineQuickStartCard } from '@/features/routines/components';
import { Button } from '@/shared/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface RoutinesSectionProps {
  onStartWorkout: (routine: GuestRecipe) => void;
}

export const RoutinesSection: React.FC<RoutinesSectionProps> = ({ onStartWorkout }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const guestData = useGuestStore();

  // Fetch routines from backend for authenticated users
  const { data: serverRoutines = [], isLoading } = useQuery({
    queryKey: ['routines', 'quickstart', 2],
    queryFn: async () => {
      const result = await getRoutines('createdAt', 0, 2);
      return result.data;
    },
    enabled: isAuthenticated,
  });

  // NOTE: Guest data still uses 'recipes' field; treat as routines for UI.
  const routines: GuestRecipe[] = isAuthenticated
    ? (Array.isArray(serverRoutines) ? serverRoutines.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        description: r.description,
        exercises: (r.exercise_templates || []).map((t: any) => ({
          id: String(t.id),
          exercise_type_id: String(t.exercise_type_id),
          exercise_type: t.exercise_type ? {
            id: String(t.exercise_type.id),
            name: t.exercise_type.name,
            description: t.exercise_type.description || '',
            default_intensity_unit: t.exercise_type.default_intensity_unit,
            times_used: t.exercise_type.times_used,
          } : {
            id: String(t.exercise_type_id),
            name: 'Unknown Exercise',
            description: '',
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
      })) : [])
    : (Array.isArray(guestData.recipes) ? guestData.recipes : []);


  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-muted-foreground">Quick Start Routines</h3>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (routines.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-6">
      <Accordion type="single" collapsible>
        <AccordionItem value="quick-start-routines">
          <AccordionTrigger className="py-0 justify-start gap-2">
            <h2 className="text-lg font-semibold text-muted-foreground">Quick Start Routines</h2>
          </AccordionTrigger>
          <AccordionContent>
            <div className="w-full px-1 sm:px-3">
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 min-w-0 w-0 overflow-x-auto">
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
                <Button asChild size="icon" variant="ghost" aria-label="Browse all routines">
                  <Link to="/routines">
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
