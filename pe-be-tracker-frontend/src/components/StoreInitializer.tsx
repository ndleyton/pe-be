import React, { useEffect, useRef } from 'react';
import { useAuthStore, useUIStore } from '@/stores';

interface StoreInitializerProps {
  children: React.ReactNode;
}

/**
 * Component that initializes Zustand stores on app startup
 * Replace AuthProvider with this component
 */
export const StoreInitializer: React.FC<StoreInitializerProps> = ({ children }) => {
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initialized.current) return;
    initialized.current = true;

    // Initialize auth store on mount
    const initialize = useAuthStore.getState().initialize;
    initialize();
  }, []); // Empty dependency array - only run once on mount

  // Cleanup workout timer interval on unmount
  useEffect(() => {
    return () => {
      // Cleanup function doesn't need to be in dependencies
      const stopWorkoutTimer = useUIStore.getState().stopWorkoutTimer;
      stopWorkoutTimer();
    };
  }, []); // Empty dependency array - cleanup only on unmount

  return <>{children}</>;
};