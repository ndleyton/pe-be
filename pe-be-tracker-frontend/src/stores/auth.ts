import { create } from 'zustand';
import api from '@/shared/api/client';
import { useGuestStore } from './guest';
import { syncGuestDataToServer, showSyncSuccessToast, showSyncErrorToast } from '@/utils/syncGuestData';

export interface User {
  id: number;
  email: string;
  name?: string | null;
}

interface AuthStore {
  // State
  user: User | null;
  loading: boolean;

  // Actions
  login: (user: User) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  initialize: () => Promise<void>;

  // Internal actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  user: null,
  loading: true,

  // Actions
  login: (user) => {
    set({ user, loading: false });
    
    // Auto-sync guest data when user logs in
    const guestData = useGuestStore.getState();
    if (guestData.workouts.length > 0) {
      syncGuestDataToServer(
        {
          workouts: guestData.workouts,
          exerciseTypes: guestData.exerciseTypes,
          workoutTypes: guestData.workoutTypes,
          recipes: guestData.recipes,
        },
        guestData.clear
      ).then((result) => {
        if (result.success) {
          showSyncSuccessToast(result);
        } else {
          showSyncErrorToast(result.error ?? 'Unknown error');
        }
      });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/jwt/logout');
    } catch {
      // Ignore logout errors
    } finally {
      set({ user: null, loading: false });
      // Redirect to landing page
      window.location.href = '/';
    }
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get<User>('/users/me');
      set({ user: data, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  initialize: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get<User>('/users/me');
      set({ user: data, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  // Internal actions
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));

// Selector functions - use these instead of computed getters
export const selectIsAuthenticated = (state: AuthStore) => !!state.user;
export const selectUser = (state: AuthStore) => state.user;
export const selectLoading = (state: AuthStore) => state.loading;