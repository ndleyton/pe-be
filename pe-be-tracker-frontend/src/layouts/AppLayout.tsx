import { useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore, useGuestStore, useUIStore } from "@/stores";
import { getMyWorkouts } from "@/features/workouts";
import AppBar from "../shared/components/layout/AppBar";
import SideDrawer from "../shared/components/layout/SideDrawer";
import DesktopSidebar from "../shared/components/layout/DesktopSidebar";
import BottomNav from "../shared/components/layout/BottomNav";
import GuestModeBanner from "../shared/components/feedback/GuestModeBanner";

const getActiveWorkout = <T extends {
  id: string | number;
  start_time: string;
  end_time: string | null;
},>(workouts: T[]): T | null =>
  workouts.reduce<T | null>((activeWorkout, workout) => {
    if (workout.end_time) {
      return activeWorkout;
    }

    if (!activeWorkout) {
      return workout;
    }

    return new Date(workout.start_time).getTime()
      > new Date(activeWorkout.start_time).getTime()
      ? workout
      : activeWorkout;
  }, null);

const AppLayout = () => {
  // Guest banner is rendered as an overlay so it won't affect layout
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestHydrated = useGuestStore((state) => state.hydrated);
  const guestWorkouts = useGuestStore((state) => state.workouts);
  const syncWorkoutTimer = useUIStore((state) => state.syncWorkoutTimer);

  const { data: serverWorkoutsResponse, status: workoutsStatus } = useQuery({
    queryKey: ["workouts"],
    queryFn: () => getMyWorkouts(undefined, 100),
    enabled: initialized && isAuthenticated,
  });

  const activeServerWorkout = useMemo(
    () => getActiveWorkout(serverWorkoutsResponse?.data ?? []),
    [serverWorkoutsResponse?.data],
  );
  const activeGuestWorkout = useMemo(
    () => getActiveWorkout(guestWorkouts),
    [guestWorkouts],
  );

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (isAuthenticated) {
      if (workoutsStatus !== "success") {
        return;
      }

      syncWorkoutTimer(
        activeServerWorkout
          ? {
            id: activeServerWorkout.id,
            startTime: activeServerWorkout.start_time,
            endTime: activeServerWorkout.end_time,
          }
          : null,
      );
      return;
    }

    if (!guestHydrated) {
      return;
    }

    syncWorkoutTimer(
      activeGuestWorkout
        ? {
          id: activeGuestWorkout.id,
          startTime: activeGuestWorkout.start_time,
          endTime: activeGuestWorkout.end_time,
        }
        : null,
    );
  }, [
    initialized,
    isAuthenticated,
    workoutsStatus,
    activeServerWorkout,
    guestHydrated,
    activeGuestWorkout,
    syncWorkoutTimer,
  ]);

  return (
    <div className="bg-background flex min-h-screen">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-content sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="relative flex flex-1 flex-col lg:ml-64">
        {/* Top App Bar */}
        <AppBar />

        {/* Guest Mode Banner overlay (positioned relative to this container) */}
        <GuestModeBanner />

        {/* Side Drawer (mobile/tablet) */}
        <SideDrawer />

        {/* Main Content */}
        <main
          id="main-content"
          className="flex-1 pb-16 md:pb-0"
          role="main"
          style={{ minHeight: "calc(100vh - 4rem)" }}
        >
          <Outlet />
        </main>

        {/* Bottom Navigation (mobile only) */}
        <BottomNav />
      </div>
    </div>
  );
};

export default AppLayout;
