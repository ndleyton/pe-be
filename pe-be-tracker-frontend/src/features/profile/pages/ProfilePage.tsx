import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getMyWorkouts, type Workout } from "@/features/workouts";
import { WeekTracking } from "@/shared/components/WeekTracking";
import { useAuthStore, useGuestStore } from "@/stores";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { ModeToggle } from "@/shared/components/theme/mode-toggle";
import { Dumbbell, Check, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const fetchWorkouts = async (): Promise<Workout[]> => {
  const { data } = await getMyWorkouts(undefined, 100);
  return data;
};

const ProfilePage = () => {
  // Use new store structure
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loading = useAuthStore((state) => state.loading);
  const guestWorkouts = useGuestStore((state) => state.workouts);

  const {
    data: serverWorkouts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["profile-workouts"],
    queryFn: fetchWorkouts,
    // Only fetch server workouts if user is authenticated
    enabled: !loading && isAuthenticated,
    retry: (failureCount, error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.status === 403)
      ) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const workouts: Workout[] = useMemo(() => {
    // Don't compute workouts until auth loading is complete
    if (loading) return [];

    if (isAuthenticated) {
      // For authenticated users, use server data (will be empty array until loaded)
      return Array.isArray(serverWorkouts) ? serverWorkouts : [];
    } else {
      // For guest users, use guest data immediately
      return Array.isArray(guestWorkouts)
        ? guestWorkouts.map((gw) => ({
          id: gw.id,
          name: gw.name,
          notes: gw.notes,
          start_time: gw.start_time,
          end_time: gw.end_time,
          workout_type_id: Number(gw.workout_type_id),
          created_at: gw.created_at || new Date().toISOString(),
          updated_at: gw.updated_at || new Date().toISOString(),
        }))
        : [];
    }
  }, [loading, isAuthenticated, serverWorkouts, guestWorkouts]);

  // defensive programming to ensure arrays are always arrays
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const completedWorkouts = safeWorkouts.filter((w) => w.end_time);
  const totalWorkouts = safeWorkouts.length;
  const averageWorkoutTime =
    completedWorkouts.length > 0
      ? completedWorkouts.reduce((sum, workout) => {
        if (workout.end_time) {
          const duration =
            new Date(workout.end_time).getTime() -
            new Date(workout.start_time).getTime();
          return sum + duration;
        }
        return sum;
      }, 0) /
      completedWorkouts.length /
      (1000 * 60) // Convert to minutes
      : 0;

  if (isAuthenticated && error) {
    return (
      <div className="p-4">
        <div className="mx-auto max-w-4xl">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load profile data</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-center sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl text-glow bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">Profile</h1>
        </div>

        <WeekTracking
          workouts={workouts}
          loading={loading || isLoading}
          className="mb-8"
        />

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-6 backdrop-blur-md transition-all duration-300 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider opacity-70">Total Workouts</p>
                <p className="text-foreground mt-1 text-3xl font-black">
                  {totalWorkouts}
                </p>
              </div>
              <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/20">
                <Dumbbell className="h-7 w-7" />
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-6 backdrop-blur-md transition-all duration-300 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider opacity-70">Completed</p>
                <p className="text-foreground mt-1 text-3xl font-black">
                  {completedWorkouts.length}
                </p>
              </div>
              <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/20">
                <Check className="h-7 w-7" />
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-6 backdrop-blur-md transition-all duration-300 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider opacity-70">Avg Duration</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-foreground mt-1 text-3xl font-black">
                    {averageWorkoutTime > 0
                      ? Math.round(averageWorkoutTime)
                      : "0"}
                  </p>
                  <span className="text-muted-foreground text-sm font-bold">min</span>
                </div>
              </div>
              <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/20">
                <Timer className="h-7 w-7" />
              </div>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="rounded-3xl border border-border/40 bg-card/40 p-8 shadow-sm backdrop-blur-md">
          <h2 className="mb-8 text-center text-xl font-black tracking-tight text-foreground uppercase opacity-80 decoration-primary underline-offset-8 decoration-4">Account Information</h2>

          <div className="mx-auto max-w-sm space-y-8">
            <div className="flex items-center justify-between group">
              <div className="text-left">
                <label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Storage Sync</label>
                <p className="text-lg font-black text-foreground">
                  {isAuthenticated ? "Authenticated Session" : "Local Guest Storage"}
                </p>
              </div>
              <div className={cn(
                "h-3 w-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]",
                isAuthenticated ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
              )} />
            </div>

            {!isAuthenticated && (
              <Alert className="rounded-2xl border-primary/20 bg-primary/5 p-4 text-left">
                <AlertTitle className="text-primary flex items-center gap-2 font-black text-sm uppercase tracking-wider mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">!</span>
                  Sync Recommended
                </AlertTitle>
                <AlertDescription className="text-sm font-medium leading-relaxed opacity-90">
                  You're currently using guest storage. Sign in to protect your data and access it from any device.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <div className="text-left">
                <label className="text-muted-foreground text-xs font-bold uppercase tracking-wider block mb-2">Visual Theme</label>
                <ModeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
