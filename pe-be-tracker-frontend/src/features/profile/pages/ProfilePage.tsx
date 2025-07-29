import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { getMyWorkouts, type Workout } from '@/features/workouts';
import { WeekTracking } from '@/shared/components/WeekTracking';
import { useAuthStore, useGuestStore } from '@/stores';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import { ModeToggle } from '@/shared/components/theme/mode-toggle';

const fetchWorkouts = async (): Promise<Workout[]> => {
  const { data } = await getMyWorkouts(undefined, 100);
  return data;
};

const ProfilePage: React.FC = () => {
  // Use new store structure
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loading = useAuthStore((state) => state.loading);
  const guestWorkouts = useGuestStore((state) => state.workouts);
  
  const { data: serverWorkouts = [], isLoading, error } = useQuery({
    queryKey: ['profile-workouts'],
    queryFn: fetchWorkouts,
    // Only fetch server workouts if user is authenticated
    enabled: !loading && isAuthenticated,
    retry: (failureCount, error: unknown) => {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const workouts: Workout[] = React.useMemo(() => {
    // Don't compute workouts until auth loading is complete
    if (loading) return [];
    
    if (isAuthenticated) {
      // For authenticated users, use server data (will be empty array until loaded)
      return Array.isArray(serverWorkouts) ? serverWorkouts : [];
    } else {
      // For guest users, use guest data immediately
      return Array.isArray(guestWorkouts) ? guestWorkouts.map(gw => ({
        id: gw.id,
        name: gw.name,
        notes: gw.notes,
        start_time: gw.start_time,
        end_time: gw.end_time,
        created_at: gw.created_at || new Date().toISOString(),
        updated_at: gw.updated_at || new Date().toISOString(),
      })) : [];
    }
  }, [loading, isAuthenticated, serverWorkouts, guestWorkouts]);

  // defensive programming to ensure arrays are always arrays
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const completedWorkouts = safeWorkouts.filter(w => w.end_time);
  const totalWorkouts = safeWorkouts.length;
  const averageWorkoutTime = completedWorkouts.length > 0 
    ? completedWorkouts.reduce((sum, workout) => {
        if (workout.end_time) {
          const duration = new Date(workout.end_time).getTime() - new Date(workout.start_time).getTime();
          return sum + duration;
        }
        return sum;
      }, 0) / completedWorkouts.length / (1000 * 60) // Convert to minutes
    : 0;

  if (isAuthenticated && isLoading) {
    return (
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
                      <div className="h-8 bg-muted rounded w-48 mb-6"></div>
          <div className="h-32 bg-muted rounded mb-6"></div>
          <div className="h-48 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && error) {
    return (
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load profile data
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8 text-center">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-1">Track your fitness journey</p>
        </div>
        
        <WeekTracking workouts={workouts} className="mb-6" />
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Workouts</p>
                <p className="text-2xl font-bold text-primary">{totalWorkouts}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-2xl">💪</span>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-secondary">{completedWorkouts.length}</p>
              </div>
              <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold text-accent">
                  {averageWorkoutTime > 0 ? `${Math.round(averageWorkoutTime)}m` : '0m'}
                </p>
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                <span className="text-2xl">⏱️</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Profile Section */}
        <div className="bg-card rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Account Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Status</label>
              <p className="font-medium">
                {isAuthenticated ? 'Signed In' : 'Guest Mode'}
              </p>
            </div>
            
            {!isAuthenticated && (
              <Alert>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <AlertTitle>Guest Mode Active</AlertTitle>
                <AlertDescription>
                  Sign in to sync your workouts across devices and keep them safe.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <label className="text-xl">Theme: </label>
              <ModeToggle />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;