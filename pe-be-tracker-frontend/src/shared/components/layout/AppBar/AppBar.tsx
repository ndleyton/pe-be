import { Link, matchPath, useLocation } from "react-router-dom";
import { Menu, Pause, Play } from "lucide-react";
import { useUIStore, useAuthStore } from "@/stores";
import HomeLogo from "../HomeLogo";
import { useGoogleSignIn } from "@/features/auth/hooks";
import { Button } from "@/shared/components/ui/button";
import { NAV_PATHS } from "@/shared/navigation/constants";

const getDesktopPageTitle = (pathname: string) => {
  if (matchPath("/workouts/:workoutId", pathname)) {
    return "Workout";
  }

  if (matchPath("/exercise-types/:exerciseTypeId", pathname)) {
    return "Exercise";
  }

  if (matchPath("/routines/:routineId", pathname)) {
    return "Routine Editor";
  }

  if (matchPath(NAV_PATHS.WORKOUTS, pathname)) {
    return "Workouts";
  }

  if (matchPath(NAV_PATHS.EXERCISES, pathname)) {
    return "Exercises";
  }

  if (matchPath("/routines", pathname)) {
    return "Routines";
  }

  if (matchPath(NAV_PATHS.CHAT, pathname)) {
    return "AI Chat";
  }

  if (matchPath(NAV_PATHS.PROFILE, pathname)) {
    return "Profile";
  }

  if (matchPath("/about", pathname)) {
    return "About";
  }

  return "Page Not Found";
};

const AppBar = () => {
  const location = useLocation();
  const toggleDrawer = useUIStore((state) => state.toggleDrawer);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialized = useAuthStore((state) => state.initialized);
  const pageTitle = getDesktopPageTitle(location.pathname);

  const googleSignIn = useGoogleSignIn();

  const startTime = useUIStore((state) => state.workoutTimer.startTime);
  const formatted = useUIStore((state) => state.getFormattedWorkoutTime());
  const paused = useUIStore((state) => state.workoutTimer.paused);
  const togglePause = useUIStore((state) => state.toggleWorkoutTimer);

  return (
    <header
      className="bg-background border-b px-4"
      role="banner"
      aria-label="Primary navigation"
    >
      <div className="relative flex h-16 items-center justify-center lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-4">
        <div className="absolute left-0 flex items-center lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleDrawer}
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        <div className="hidden min-w-0 items-center lg:flex">
          <h1 className="text-foreground truncate text-lg font-semibold">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center lg:hidden">
          <Button asChild variant="ghost" className="text-xl">
            <Link to={NAV_PATHS.WORKOUTS} aria-label="Go to workouts">
              <HomeLogo />
            </Link>
          </Button>
        </div>

        <div className="absolute right-0 flex items-center space-x-2 lg:static lg:justify-self-end">
          {startTime && (
            <button
              type="button"
              onClick={togglePause}
              aria-label={paused ? "Resume timer" : "Pause timer"}
              className={`hover:bg-muted/50 focus-visible:ring-ring items-center space-x-1 rounded-md px-2 py-1 focus:outline-none focus-visible:ring-2 ${
                isAuthenticated ? "flex" : "hidden lg:flex"
              }`}
            >
              <span className="font-mono text-sm" aria-label="Workout timer">
                {formatted}
              </span>
              {paused ? (
                <Play className="h-5 w-5" />
              ) : (
                <Pause className="h-5 w-5" />
              )}
            </button>
          )}
          {initialized && !isAuthenticated && (
            <Button onClick={googleSignIn} size="sm">
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppBar;
