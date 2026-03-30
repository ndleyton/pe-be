import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GoogleSignInButton } from "@/features/auth/components";
import { useGoogleSignIn } from "@/features/auth/hooks";
import {
  getPostLoginDestination,
  persistPostLoginDestination,
} from "@/features/auth/lib/postLoginRedirect";
import { HomeLogo } from "@/shared/components/layout";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { useAuthStore } from "@/stores/useAuthStore";

const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const googleSignIn = useGoogleSignIn();
  const pendingGoogleSignInRef = useRef(false);
  const { isAuthenticated, loading, initialized } = useAuthStore();

  const nextPath = useMemo(
    () => getPostLoginDestination(location.search),
    [location.search],
  );
  const shouldStartGoogleSignIn = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("auth_intent") === "google";
  }, [location.search]);

  const handleTryAsGuest = () => {
    navigate(NAV_PATHS.WORKOUTS);
  };

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (isAuthenticated) {
      pendingGoogleSignInRef.current = false;
      navigate(nextPath, { replace: true });
      return;
    }

    if (shouldStartGoogleSignIn) {
      persistPostLoginDestination(nextPath);
      pendingGoogleSignInRef.current = true;
      navigate(
        {
          pathname: location.pathname,
          hash: location.hash,
        },
        { replace: true },
      );
      return;
    }

    if (!pendingGoogleSignInRef.current) {
      persistPostLoginDestination(nextPath);
    }
  }, [
    initialized,
    isAuthenticated,
    location.hash,
    location.pathname,
    navigate,
    nextPath,
    shouldStartGoogleSignIn,
  ]);

  useEffect(() => {
    if (!pendingGoogleSignInRef.current) {
      return;
    }

    if (!initialized || isAuthenticated || shouldStartGoogleSignIn) {
      return;
    }

    pendingGoogleSignInRef.current = false;
    void googleSignIn();
  }, [googleSignIn, initialized, isAuthenticated, shouldStartGoogleSignIn]);

  if (!initialized || loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-spinner loading-lg" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="p-4">
        <HomeLogo />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="bg-card flex w-full max-w-xs flex-col items-center gap-6 rounded-xl p-8 shadow-lg">
          <h1 className="text-card-foreground mb-4 text-center text-2xl font-bold">
            Welcome to PersonalBestie
          </h1>

          <div className="w-full space-y-4">
            <GoogleSignInButton />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="border-border w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card text-muted-foreground px-2"></span>
              </div>
            </div>

            <button
              onClick={handleTryAsGuest}
              className="border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-ring w-full rounded-md border px-4 py-2 shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
            >
              Try as Guest
            </button>
          </div>

          <p className="text-muted-foreground text-center text-xs">
            Guest mode stores data locally. Sign in to sync across devices.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
