import { create } from 'zustand';

export interface User {
  id: number;
  email: string;
  name?: string | null;
}

interface SimpleAuthStore {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useSimpleAuthStore = create<SimpleAuthStore>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));

// Simple selectors
export const selectUser = (state: SimpleAuthStore) => state.user;
export const selectLoading = (state: SimpleAuthStore) => state.loading;
export const selectIsAuthenticated = (state: SimpleAuthStore) => !!state.user;