import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGuestStore, useAuthStore, GuestRecipe } from '@/stores';
import { getRoutines, deleteRoutine } from '@/features/routines/api';
import { RoutineQuickStartCard } from '@/features/routines/components';
import { Button } from '@/shared/components/ui/button';
import { Link } from 'react-router-dom';

interface RoutinesSectionProps {
  onStartWorkout: (routine: GuestRecipe) => void;
}

export const RoutinesSection: React.FC<RoutinesSectionProps> = ({ onStartWorkout }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();
  const queryClient = useQueryClient();

  // Fetch routines from backend for authenticated users
  const { data: serverRoutines = [], isLoading } = useQuery({
    queryKey: ['routines', 'quickstart'],
    queryFn: async () => {
      const result = await getRoutines('createdAt', 0, 100);
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

  const handleDeleteRoutine = async (routineId: string) => {
    if (isAuthenticated) {
      try {
        await deleteRoutine(routineId);
        queryClient.invalidateQueries({ queryKey: ['routines'] });
      } catch (error) {
        console.error('Error deleting routine:', error);
      }
    } else {
      guestActions.deleteRoutine(routineId);
    }
  };

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Quick Start Routines</h2>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (routines.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 w-full max-w-full overflow-x-hidden min-w-0">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Quick Start Routines</h2>
            <Button asChild variant="link" size="sm">
            <Link to="/routines" aria-label="Browse all routines">More</Link>
            </Button>
        </div>
        <div className="w-full max-w-full overflow-x-auto min-w-0">
            <div className="flex flex-nowrap gap-3 px-1 sm:px-3 py-1">
                {routines.map((routine) => (
                <div key={routine.id} className="flex-none w-[12rem] sm:w-[14rem] md:w-[16rem]">
                    <RoutineQuickStartCard
                        routine={routine}
                        onStartWorkout={onStartWorkout}
                    />
                </div>
                ))}
            </div>
        </div>
    </div>
  );
};


