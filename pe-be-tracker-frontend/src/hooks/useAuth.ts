import { useAuthStore } from '@/stores';

/**
 * Compatibility hook for useAuth that uses Zustand store
 * Provides the same interface as the old AuthContext
 */
export const useAuth = () => {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refresh = useAuthStore((state) => state.refresh);
  const signOut = useAuthStore((state) => state.logout);

  return {
    user,
    loading,
    isAuthenticated: () => isAuthenticated,
    refresh,
    signOut,
  };
}; 