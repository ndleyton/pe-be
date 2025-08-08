import React, { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';
import { initializeAuth, useAuthStore } from './useAuthStore';
import { useGuestStore } from './useGuestStore';

interface StoreInitializerProps {
  children: React.ReactNode;
}

export const StoreInitializer: React.FC<StoreInitializerProps> = ({ children }) => {
  const initialized = useRef(false);
  const user = useAuthStore(state => state.user);
  const syncWithServer = useGuestStore(state => state.syncWithServer);
  const posthog = usePostHog();
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
    if (!posthog) return;

    if (user) {
      const distinctId = String(user.id);
      if (lastIdentifiedIdRef.current !== distinctId) {
        posthog.identify(distinctId, {
          email: user.email,
          name: user.name ?? undefined,
        });
        lastIdentifiedIdRef.current = distinctId;
      }
    } else if (lastIdentifiedIdRef.current) {
      // User signed out; reset identification to anonymous
      posthog.reset();
      lastIdentifiedIdRef.current = null;
    }
  }, [user, posthog]);

  return <>{children}</>;
};