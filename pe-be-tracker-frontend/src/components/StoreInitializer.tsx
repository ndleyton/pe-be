import React, { useEffect } from 'react';
import { useAuthStore, useUIStore } from '@/stores';

interface StoreInitializerProps {
  children: React.ReactNode;
}

/**
 * Component that initializes Zustand stores on app startup
 * Replace AuthProvider with this component
 */
export const StoreInitializer: React.FC<StoreInitializerProps> = ({ children }) => {
  const initialize = useAuthStore((state) => state.initialize);
  const stopWorkoutTimer = useUIStore((state) => state.stopWorkoutTimer);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Cleanup workout timer interval on unmount
  useEffect(() => {
    return () => {
      stopWorkoutTimer();
    };
  }, [stopWorkoutTimer]);

  return <>{children}</>;
};