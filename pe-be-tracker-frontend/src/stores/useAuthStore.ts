import { create } from "zustand";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";

interface User {
  id: number;
  email: string;
  name?: string | null;
  is_superuser?: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
}

interface AuthActions {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

let refreshPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: true,
  isAuthenticated: false,
  initialized: false,

  refresh: async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      const { setLoading } = get();
      setLoading(true);

      try {
        const { data } = await api.get<User>(endpoints.auth.session);
        set({
          user: data,
          loading: false,
          isAuthenticated: true,
          initialized: true,
        });
      } catch {
        set({
          user: null,
          loading: false,
          isAuthenticated: false,
          initialized: true,
        });
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  signOut: async () => {
    try {
      await api.post(endpoints.auth.logout);
    } catch {
      /* ignore */
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
      window.location.href = "/";
    }
  },

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
      initialized: true,
    });
  },

  setLoading: (loading) => {
    set({ loading });
  },
}));

let initPromise: Promise<void> | null = null;

export const initializeAuth = (): Promise<void> => {
  if (initPromise) {
    return initPromise;
  }

  const { initialized, refresh } = useAuthStore.getState();

  if (initialized) {
    return Promise.resolve();
  }

  initPromise = refresh().finally(() => {
    initPromise = null;
  });

  return initPromise;
};
