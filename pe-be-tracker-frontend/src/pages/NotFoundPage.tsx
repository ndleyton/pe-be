import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Home } from "lucide-react";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { Button } from "@/shared/components/ui/button";

const helpfulLinks = [
  { label: "Workouts", to: NAV_PATHS.WORKOUTS },
  { label: "Exercises", to: NAV_PATHS.EXERCISES },
  { label: "AI Chat", to: NAV_PATHS.CHAT },
] as const;

const NotFoundPage = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    const historyIndex =
      typeof window.history.state?.idx === "number"
        ? window.history.state.idx
        : 0;

    if (historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(NAV_PATHS.WORKOUTS, { replace: true });
  };

  return (
    <div className="bg-background flex min-h-full items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="bg-card w-full max-w-lg rounded-3xl border px-6 py-8 text-center shadow-sm sm:px-8">
        <div className="mb-6 flex justify-center">
          <div className="bg-destructive/10 rounded-full p-4 sm:p-5">
            <AlertTriangle className="text-destructive h-10 w-10 sm:h-12 sm:w-12" />
          </div>
        </div>

        <p className="text-primary mb-3 text-sm font-semibold tracking-[0.3em] uppercase">
          404
        </p>

        <h1 className="text-foreground mb-3 text-3xl font-semibold text-balance sm:text-4xl">
          Page Not Found
        </h1>

        <p className="text-muted-foreground mx-auto mb-8 max-w-md text-sm leading-6 sm:text-base">
          The page you tried to open does not exist anymore, or the link is
          incorrect. Use one of the routes below to get back into the app.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild size="lg" className="w-full rounded-xl">
            <Link to={NAV_PATHS.WORKOUTS}>
              <Home className="h-5 w-5" />
              Go to Workouts
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full rounded-xl"
            onClick={handleGoBack}
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </Button>
        </div>

        <div className="border-border mt-8 border-t pt-6">
          <p className="text-muted-foreground mb-4 text-sm">
            Quick links
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {helpfulLinks.map((link) => (
              <Button
                key={link.to}
                asChild
                variant="ghost"
                className="border-border hover:bg-accent h-auto rounded-xl border px-4 py-3"
              >
                <Link to={link.to}>{link.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
