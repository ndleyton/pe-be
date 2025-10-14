import { useAuthStore } from "@/stores";
import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft, AlertTriangle } from "lucide-react";
import { NAV_PATHS } from "@/shared/navigation/constants";

const NotFoundPage = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleGoHome = () => {
    // Navigate to workouts if authenticated, otherwise to landing page
    navigate(isAuthenticated ? NAV_PATHS.WORKOUTS : "/");
  };

  const handleGoBack = () => {
    // Go back in browser history
    window.history.back();
  };

  return (
    <div className="bg-background mx-auto flex min-h-screen max-w-5xl items-center justify-center p-8 text-center">
      <div className="w-full max-w-md">
        {/* Error Icon */}
        <div className="mb-6 flex justify-center">
          <div className="bg-destructive/10 rounded-full p-6">
            <AlertTriangle className="text-destructive h-16 w-16" />
          </div>
        </div>

        {/* Error Code */}
        <h1 className="text-primary mb-2 text-8xl font-bold">404</h1>

        {/* Error Message */}
        <h2 className="text-foreground mb-4 text-2xl font-semibold">
          Page Not Found
        </h2>

        <p className="text-muted-foreground mb-8 leading-relaxed">
          Oops! The page you're looking for doesn't exist. It might have been
          moved, deleted, or you entered the wrong URL.
        </p>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleGoHome}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors duration-200"
          >
            <Home className="h-5 w-5" />
            {isAuthenticated ? "Go to Workouts" : "Go to Home"}
          </button>

          <button
            onClick={handleGoBack}
            className="bg-muted hover:bg-accent text-muted-foreground flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </button>
        </div>

        {/* Helpful Links */}
        <div className="border-border mt-12 border-t pt-8">
          <p className="text-muted-foreground mb-4 text-sm">
            Need help? Try these:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => navigate(NAV_PATHS.WORKOUTS)}
              className="text-primary hover:text-primary/90 hover:underline"
              disabled={!isAuthenticated}
            >
              Workouts
            </button>
            <button
              onClick={() => navigate(NAV_PATHS.EXERCISES)}
              className="text-primary hover:text-primary/90 hover:underline"
              disabled={!isAuthenticated}
            >
              Exercises
            </button>
            <button
              onClick={() => navigate(NAV_PATHS.CHAT)}
              className="text-primary hover:text-primary/90 hover:underline"
              disabled={!isAuthenticated}
            >
              AI Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
