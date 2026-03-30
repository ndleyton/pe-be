import { Menu, Pause, Play } from "lucide-react";
import { useUIStore, useAuthStore } from "@/stores";
import HomeLogo from "../HomeLogo";
import { useGoogleSignIn } from "@/features/auth/hooks";
import { Button } from "@/shared/components/ui/button";

const AppBar = () => {
  const toggleDrawer = useUIStore((state) => state.toggleDrawer);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialized = useAuthStore((state) => state.initialized);

  const googleSignIn = useGoogleSignIn();

  // Get workout timer state from UI store
  const startTime = useUIStore((state) => state.workoutTimer.startTime);
  const formatted = useUIStore((state) => state.getFormattedWorkoutTime());
  const paused = useUIStore((state) => state.workoutTimer.paused);
  const togglePause = useUIStore((state) => state.toggleWorkoutTimer);

  return (
    <header
      className="bg-background relative flex h-16 items-center justify-center border-b px-4"
      role="banner"
      aria-label="Primary navigation"
    >
      {/* Left section for hamburger menu */}
      <div className="absolute left-4 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden" // Only show on mobile/tablet
          onClick={toggleDrawer}
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile-only brand. Desktop uses the sidebar logo as the primary home affordance. */}
      <div className="flex items-center lg:hidden">
        <Button
          variant="ghost"
          className="text-xl" // You can adjust styling here if needed
          aria-label="Go to home"
        >
          <HomeLogo />
        </Button>
      </div>

      {/* Right section: timer (clickable) and optional auth button */}
      <div className="absolute right-4 flex items-center space-x-2">
        {startTime && (
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? "Resume timer" : "Pause timer"}
            className={`hover:bg-muted/50 focus-visible:ring-ring items-center space-x-1 rounded-md px-2 py-1 focus:outline-none focus-visible:ring-2 ${
              isAuthenticated ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Timer text always visible */}
            <span className="font-mono text-sm" aria-label="Workout timer">
              {formatted}
            </span>
            {/* Always show icon */}
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
    </header>
  );
};

export default AppBar;
