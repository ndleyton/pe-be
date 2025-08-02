import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavigationState {
  lastVisitedPaths: Record<string, string>;
}

interface NavigationActions {
  setLastVisitedPath: (navKey: string, path: string) => void;
  getLastVisitedPath: (navKey: string, defaultPath: string) => string;
}

type NavigationStore = NavigationState & NavigationActions;

export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set, get) => ({
      lastVisitedPaths: {},

      setLastVisitedPath: (navKey: string, path: string) => {
        set(state => ({
          lastVisitedPaths: {
            ...state.lastVisitedPaths,
            [navKey]: path
          }
        }));
      },

      getLastVisitedPath: (navKey: string, defaultPath: string) => {
        const { lastVisitedPaths } = get();
        return lastVisitedPaths[navKey] || defaultPath;
      },
    }),
    {
      name: 'navigation-storage',
      storage: {
        getItem: (name) => {
          try {
            return localStorage.getItem(name) || null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch (error) {
            console.warn('Failed to persist navigation state:', error);
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            // ignore
          }
        },
      },
    }
  )
);