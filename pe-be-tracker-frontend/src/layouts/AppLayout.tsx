import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useUIStore } from "@/stores";
import { useMyWorkoutsData } from "@/features/workouts";
import AppBar from "../shared/components/layout/AppBar";
import SideDrawer from "../shared/components/layout/SideDrawer";
import DesktopSidebar from "../shared/components/layout/DesktopSidebar";
import BottomNav from "../shared/components/layout/BottomNav";
import GuestModeBanner from "../shared/components/feedback/GuestModeBanner";
import { useAppHistoryTracker } from "@/shared/hooks";

const AppLayout = () => {
  useAppHistoryTracker();

  const syncWorkoutTimer = useUIStore((state) => state.syncWorkoutTimer);
  const { activeWorkout, hasLoadedWorkouts } = useMyWorkoutsData();

  useEffect(() => {
    if (!hasLoadedWorkouts) {
      return;
    }

    syncWorkoutTimer(
      activeWorkout
        ? {
          id: activeWorkout.id,
          startTime: activeWorkout.start_time,
          endTime: activeWorkout.end_time,
        }
        : null,
    );
  }, [activeWorkout, hasLoadedWorkouts, syncWorkoutTimer]);

  return (
    <div className="bg-background flex min-h-screen min-h-dvh">
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
