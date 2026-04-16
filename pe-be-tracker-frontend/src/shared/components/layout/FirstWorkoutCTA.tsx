import { useUIStore } from "@/stores";
import { useMyWorkoutsData } from "@/features/workouts";
import { Button } from "@/shared/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { NAV_PATHS } from "@/shared/navigation/constants";

export const FirstWorkoutCTA = () => {
  const { workouts, isLoading } = useMyWorkoutsData();
  const { openWorkoutForm, closeDrawer } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Only show if workouts are loaded and there are none
  if (isLoading || (workouts && workouts.length > 0)) {
    return null;
  }

  const handleStart = () => {
    openWorkoutForm();
    closeDrawer();
    if (location.pathname !== NAV_PATHS.WORKOUTS) {
      navigate(NAV_PATHS.WORKOUTS);
    }
  };

  return (
    <div className="mx-4 mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 shadow-sm backdrop-blur-sm relative group">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />

      <div className="relative">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PlusCircle className="h-5 w-5" />
        </div>

        <h3 className="mb-1 text-sm font-bold text-foreground tracking-tight">
          Start Training
        </h3>

        <p className="mb-3 text-[11px] text-muted-foreground leading-normal">
          Log your first workout to track progress.
        </p>

        <Button
          size="sm"
          onClick={handleStart}
          className="w-full text-xs font-semibold shadow-sm transition-all duration-300 hover:shadow-primary/20"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default FirstWorkoutCTA;
