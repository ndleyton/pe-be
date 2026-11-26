import axios from "axios";
import { create } from "zustand";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";

interface User {
  id: number;
  email: string;
  name?: string | null;
  is_superuser?: boolean;
}

export const AUTH_SESSION_HINT_KEY = "pebe_had_session";

const readSessionHint = (): boolean => {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === "1"
    );
  } catch {
    return false;
  }
};

const writeSessionHint = (hasSession: boolean): void => {
  try {
    if (typeof window === "undefined") return;
    if (hasSession) {
      window.localStorage.setItem(AUTH_SESSION_HINT_KEY, "1");
    } else {
      window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
};

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
  hasSessionHint: boolean;
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
  hasSessionHint: readSessionHint(),

  refresh: async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      const { setLoading } = get();
      setLoading(true);

      try {
        const { data } = await api.get<User>(endpoints.auth.session);
        writeSessionHint(true);
        set({
          user: data,
          loading: false,
          isAuthenticated: true,
          initialized: true,
          hasSessionHint: true,
        });
      } catch (error) {
        const isAuthRejection =
          axios.isAxiosError(error) &&
          (error.response?.status === 401 || error.response?.status === 403);
        if (isAuthRejection) {
          writeSessionHint(false);
        }
        set((state) => ({
          user: null,
          loading: false,
          isAuthenticated: false,
          initialized: true,
          hasSessionHint: isAuthRejection ? false : state.hasSessionHint,
        }));
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
      writeSessionHint(false);
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        hasSessionHint: false,
      });
      window.location.href = "/";
    }
  },

  setUser: (user) => {
    writeSessionHint(!!user);
    set({
      user,
      isAuthenticated: !!user,
      initialized: true,
      hasSessionHint: !!user,
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
