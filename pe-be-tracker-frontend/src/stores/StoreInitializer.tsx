import { useEffect, useRef, type ReactNode } from "react";
import {
  identifyPostHogUser,
  resetPostHogUser,
} from "@/app/telemetry/posthog";
import { config } from "@/app/config/env";
import { setSentryTag, setSentryUser } from "@/instrument";
import { initializeAuth, useAuthStore } from "./useAuthStore";
import { useGuestStore } from "./useGuestStore";

interface StoreInitializerProps {
  children: ReactNode;
}

export const StoreInitializer = ({ children }: StoreInitializerProps) => {
  const initialized = useRef(false);
  const user = useAuthStore((state) => state.user);
  const syncWithServer = useGuestStore((state) => state.syncWithServer);
  const lastIdentifiedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initializeAuth();
    }
  }, []);

  useEffect(() => {
    if (user) {
      syncWithServer();
    }
  }, [user, syncWithServer]);

  // Identify the user in PostHog when authenticated, reset on sign-out
  useEffect(() => {
    if (user) {
      const distinctId = String(user.id);
      if (lastIdentifiedIdRef.current !== distinctId) {
        setSentryUser({ id: distinctId });
        setSentryTag("guest", "false");
        setSentryTag("is_authenticated", "true");
        setSentryTag("environment", config.environment);
        identifyPostHogUser(user);
        lastIdentifiedIdRef.current = distinctId;
      }
    } else if (lastIdentifiedIdRef.current) {
      // User signed out; reset identification to anonymous
      setSentryUser(null);
      setSentryTag("guest", "true");
      setSentryTag("is_authenticated", "false");
      resetPostHogUser();
      lastIdentifiedIdRef.current = null;
    }
  }, [user]);

  return <>{children}</>;
};
