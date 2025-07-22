import React, { useEffect, useRef } from 'react';
import { initializeAuth, useAuthStore } from './useAuthStore';
import { useGuestStore } from './useGuestStore';

interface StoreInitializerProps {
  children: React.ReactNode;
}

export const StoreInitializer: React.FC<StoreInitializerProps> = ({ children }) => {
  const initialized = useRef(false);
  const user = useAuthStore(state => state.user);
  const syncWithServer = useGuestStore(state => state.syncWithServer);

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

  return <>{children}</>;
};