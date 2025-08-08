import React from 'react';
import axios from 'axios';
import { useGuestStore, useAuthStore, GuestRecipe } from '@/stores';
import { useNavigate } from 'react-router-dom';
import { getMyWorkouts, type Workout } from '@/features/workouts';
import { WorkoutForm } from '@/features/workouts/components';
import FloatingActionButton from '@/shared/components/FloatingActionButton';
import { WeekTracking } from '@/shared/components/WeekTracking';
import { RecipesSection } from '@/features/recipes/components/RecipesSection/RecipesSection';
import { Button } from '@/shared/components/ui/button';
import { useInfiniteScroll } from '@/shared/hooks';
import { getCurrentUTCTimestamp, parseWorkoutDuration, formatDisplayDate } from '@/utils/date';
import { Dumbbell } from 'lucide-react';


const MyWorkoutsPage = () => {
  const navigate = useNavigate();
  
  // Get state from stores
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const setUser = useAuthStore(state => state.setUser);
  const guestData = useGuestStore();
  
  const [showWorkoutForm, setShowWorkoutForm] = React.useState(false);
  
  const {
    data: serverWorkouts,
    isLoading,
    isFetchingNextPage,
    error,
    refetch,
  } = useInfiniteScroll<Workout>({
    queryKey: ['workouts'],
    queryFn: (cursor, limit) => getMyWorkouts(cursor, limit),
    limit: 100,
    enabled: isAuthenticated,
  });

  // Use guest data if not authenticated, server data if authenticated
  const workouts: Workout[] = React.useMemo(() => {
    if (isAuthenticated) {
      return Array.isArray(serverWorkouts) ? serverWorkouts : [];
    } else {
      const guestWorkouts = Array.isArray(guestData?.workouts) ? guestData.workouts : [];
      return guestWorkouts.map(gw => ({
        id: gw.id,
        name: gw.name,
        notes: gw.notes,
        start_time: gw.start_time,
        end_time: gw.end_time,
        created_at: gw.created_at || getCurrentUTCTimestamp(),
        updated_at: gw.updated_at || getCurrentUTCTimestamp(),
      }));
    }
  }, [isAuthenticated, serverWorkouts, guestData?.workouts]);

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return "Please log in to view your workouts.";
      }
      return "Failed to load workouts.";
    }
    return error instanceof Error ? error.message : "Failed to load workouts.";
  };


  const handleWorkoutClick = (workoutId: number | string) => {
    navigate(`/workouts/${workoutId}`);
  };

  const [selectedRecipe, setSelectedRecipe] = React.useState<GuestRecipe | null>(null);

  const handleStartWorkoutFromRecipe = (recipe: GuestRecipe) => {
    setSelectedRecipe(recipe);
    setShowWorkoutForm(true);
  };

  // Track if we've detected an auth error to keep showing the message
  const [sessionExpired, setSessionExpired] = React.useState(false);

  React.useEffect(() => {
    const isAuthError = axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);
    if (isAuthenticated && isAuthError) {
      // Mark user as signed out so header logo routes to login
      if (typeof setUser === 'function') {
        setUser(null);
      }
      // Preserve session expired UI state on this page
      setSessionExpired(true);
    }
  }, [isAuthenticated, error, setUser]);

  if (isAuthenticated && isLoading) return <p className="text-muted-foreground">Loading workouts...</p>;

  if (sessionExpired) {
    const errorMessage = getErrorMessage(error);
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-destructive text-2xl">⚠</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Session Expired</h2>
          <p className="mb-4 text-muted-foreground">{errorMessage}</p>
          <p className="text-sm text-muted-foreground">Click the logo above to return to login</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && error) {
    const errorMessage = getErrorMessage(error);
    return <p className="text-destructive">{errorMessage}</p>;
  }

  const validWorkouts = Array.isArray(workouts) ? workouts.filter(Boolean) : [];

  return (
    <>
      <div className="max-w-5xl mx-auto p-8 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Workouts</h1>
          </div>
          <WeekTracking workouts={workouts} className="mb-6" />
          
          <RecipesSection onStartWorkout={handleStartWorkoutFromRecipe} />
          
          {showWorkoutForm && (
            <div className="mb-6">
              <WorkoutForm 
                recipe={selectedRecipe}
                onWorkoutCreated={(workoutId) => {
                  if (isAuthenticated) {
                    refetch();
                  }
                  setShowWorkoutForm(false);
                  setSelectedRecipe(null);
                  if (selectedRecipe) {
                    navigate(`/workouts/${workoutId}`, { state: { recipe: selectedRecipe } });
                  }
                }} 
              />
              <Button 
                onClick={() => {
                  setShowWorkoutForm(false);
                  setSelectedRecipe(null);
                }}
                variant="ghost"
                size="sm"
                className="mt-2"
              >
                Cancel
              </Button>
            </div>
          )}
          
          {validWorkouts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">You haven't logged any workouts yet.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {validWorkouts.map(workout => (
                  <div
                    key={workout.id}
                    onClick={() => handleWorkoutClick(workout.id)}
                    className="bg-card rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                        <Dumbbell className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-foreground font-medium">
                          {workout.name || 'Traditional Strength Training'}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-primary font-mono text-lg">
                            {parseWorkoutDuration(workout.start_time, workout.end_time).durationText}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            {formatDisplayDate(workout.start_time, { includeTime: false, includeTimezone: false })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-muted-foreground">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Loading more indicator for authenticated users */}
              {isAuthenticated && isFetchingNextPage && (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {!showWorkoutForm && (
        <FloatingActionButton
          onClick={() => setShowWorkoutForm(true)}
          dataTestId="fab-add-workout"
        >
          <span className="text-lg">+</span>
        </FloatingActionButton>
      )}
    </>
  );
};

export default MyWorkoutsPage;