import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { getRoutines, startWorkoutFromRoutine } from '@/features/routines/api';
import type { Routine } from '@/features/routines/types';
import { RoutineQuickStartCard } from '@/features/routines/components';
import { useAuthStore, useGuestStore, type GuestRecipe } from '@/stores';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import { useInfiniteScroll } from '@/shared/hooks';
import { useNavigate } from 'react-router-dom';
import api from '@/shared/api/client';

const RoutinesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();
  const [orderBy, setOrderBy] = useState<'createdAt' | 'name'>('createdAt');

  const {
    data: routines,
    isLoading,
    isFetchingNextPage,
    hasMore,
    error,
  } = useInfiniteScroll<Routine>({
    queryKey: ['routines', orderBy],
    queryFn: (cursor, limit) => getRoutines(orderBy, cursor, limit),
    limit: 100,
  });

  const filteredRoutines = useMemo(() => {
    if (!searchTerm) return routines;
    
    return routines.filter((routine) =>
      routine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (routine.description && routine.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [routines, searchTerm]);

  const handleStartWorkout = async (recipe: GuestRecipe) => {
    try {
      if (isAuthenticated) {
        const newWorkout = await startWorkoutFromRoutine(Number(recipe.id));
        navigate(`/workouts/${newWorkout.id}`);
      } else {
        const defaultWorkoutType = guestData.workoutTypes.find(wt => wt.id === '8') || guestData.workoutTypes[0];
        const newWorkoutId = guestActions.addWorkout({
          name: `${recipe.name} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          notes: null,
          start_time: new Date().toISOString(),
          end_time: null,
          workout_type_id: defaultWorkoutType.id,
          workout_type: defaultWorkoutType,
          exercises: [],
        });
        navigate(`/workouts/${newWorkoutId}`, { state: { recipe } });
      }
    } catch (error) {
      console.error('Failed to start workout from routine:', error);
    }
  };

  const convertToGuestRecipe = (routine: Routine): GuestRecipe => ({
    id: String(routine.id),
    name: routine.name,
    description: routine.description,
    exercises: (routine.exercise_templates || []).map((t: any) => ({
      id: String(t.id),
      exercise_type_id: String(t.exercise_type_id),
      exercise_type: t.exercise_type
        ? {
            id: String(t.exercise_type.id),
            name: t.exercise_type.name,
            description: t.exercise_type.description || '',
            default_intensity_unit: t.exercise_type.default_intensity_unit,
            times_used: t.exercise_type.times_used,
          }
        : {
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
    created_at: routine.created_at,
    updated_at: routine.updated_at,
  });

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error loading routines. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8 text-center">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Routines</h1>
        
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <Input
              type="text"
              placeholder="Search routines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10"
            />
          </div>
          
          <Select
            value={orderBy}
            onValueChange={(value) => setOrderBy(value as 'createdAt' | 'name')}
          >
            <SelectTrigger className="w-full sm:w-auto">
              <SelectValue placeholder="Order By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Recent</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Routines Grid */}
      {!isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRoutines.map((routine) => (
              <RoutineQuickStartCard
                key={routine.id}
                routine={convertToGuestRecipe(routine)}
                onStartWorkout={handleStartWorkout}
              />
            ))}
          </div>
          
          {/* Loading more indicator */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          )}
          
          {/* End of results indicator */}
          {!hasMore && filteredRoutines.length > 0 && (
            <div className="text-center py-8">
              <span className="text-muted-foreground text-sm">No more routines to load</span>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && filteredRoutines.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            {searchTerm ? 'No routines found matching your search.' : 'No routines available.'}
          </div>
          {searchTerm && (
            <Button
              onClick={() => setSearchTerm('')}
              variant="outline"
              size="sm"
            >
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default RoutinesPage;
