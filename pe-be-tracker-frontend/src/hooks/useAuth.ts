import { useAuthStore, selectIsAuthenticated, selectUser, selectLoading } from '@/stores';

/**
 * Compatibility hook for useAuth that uses Zustand store
 * Provides the same interface as the old AuthContext
 */
export const useAuth = () => {
  const user = useAuthStore(selectUser);
  const loading = useAuthStore(selectLoading);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
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