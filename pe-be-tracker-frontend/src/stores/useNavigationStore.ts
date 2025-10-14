import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type NavKey, NAV_PATHS } from "@/shared/navigation/constants";
import { createIndexedDBStorage } from "./indexedDBStorage";

interface NavigationState {
  lastVisitedPaths: Partial<Record<NavKey, string>>;
}

interface NavigationActions {
  setLastVisitedPath: (navKey: NavKey, path: string) => void;
  getLastVisitedPath: (navKey: NavKey, defaultPath: string) => string;
}

type NavigationStore = NavigationState & NavigationActions;

export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set, get) => ({
      lastVisitedPaths: {
        workouts: NAV_PATHS.WORKOUTS,
        exercises: NAV_PATHS.EXERCISES,
        profile: NAV_PATHS.PROFILE,
        chat: NAV_PATHS.CHAT,
      },

      setLastVisitedPath: (navKey: NavKey, path: string) => {
        const { lastVisitedPaths } = get();
        if (lastVisitedPaths[navKey] === path) {
          return;
        }

        set((state) => ({
          lastVisitedPaths: {
            ...state.lastVisitedPaths,
            [navKey]: path,
          },
        }));
      },

      getLastVisitedPath: (navKey: NavKey, defaultPath: string) => {
        const { lastVisitedPaths } = get();
        return lastVisitedPaths[navKey] || defaultPath;
      },
    }),
    {
      name: "navigation-storage",
      storage: createJSONStorage(() => createIndexedDBStorage()),
    },
  ),
);
