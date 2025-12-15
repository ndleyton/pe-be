import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createIndexedDBStorage } from "./indexedDBStorage";

interface WorkoutTimer {
  /** Start time as epoch milliseconds */
  startTime: number | null;
  elapsedSeconds: number;
  paused: boolean;
  intervalId: number | null;
  /** When paused, the epoch milliseconds of pause start */
  pausedAt: number | null;
}

interface UIState {
  isDrawerOpen: boolean;
  workoutTimer: WorkoutTimer;
}

interface UIActions {
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  /**
   * Start the workout timer at an optional absolute time (epoch ms).
   * If omitted, starts at "now".
   */
  startWorkoutTimer: (atMs?: number) => void;
  pauseWorkoutTimer: () => void;
  resumeWorkoutTimer: () => void;
  toggleWorkoutTimer: () => void;
  stopWorkoutTimer: () => void;
  getFormattedWorkoutTime: () => string;
  /** Parse persisted dates, fix elapsed, and start/stop interval appropriately */
  rehydrateWorkoutTimer: () => void;
}

type UIStore = UIState & UIActions;

const formatTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
  isDrawerOpen: false,
  workoutTimer: {
    startTime: null,
    elapsedSeconds: 0,
    paused: false,
    intervalId: null,
    pausedAt: null,
  },

  openDrawer: () => set({ isDrawerOpen: true }),

  closeDrawer: () => set({ isDrawerOpen: false }),

  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

  startWorkoutTimer: (atMs?: number) => {
    const { workoutTimer } = get();

    // Clear any existing interval to prevent memory leaks
    if (workoutTimer.intervalId) {
      clearInterval(workoutTimer.intervalId);
    }

    const startTimeMs = typeof atMs === "number" ? atMs : Date.now();
    const intervalId = window.setInterval(() => {
      // Use functional state update to avoid stale closure issues
      set((state) => {
        const { workoutTimer } = state;
        if (!workoutTimer.paused && workoutTimer.startTime) {
          const elapsed = Math.floor((Date.now() - workoutTimer.startTime) / 1000);
          return {
            workoutTimer: {
              ...workoutTimer,
              elapsedSeconds: elapsed,
            },
          };
        }
        return state;
      });
    }, 1000);

    set({
      workoutTimer: {
        startTime: startTimeMs,
        elapsedSeconds: Math.max(0, Math.floor((Date.now() - startTimeMs) / 1000)),
        paused: false,
        intervalId,
        pausedAt: null,
      },
    });
  },

  pauseWorkoutTimer: () => {
    set((state) => ({
      workoutTimer: {
        ...state.workoutTimer,
        paused: true,
        pausedAt: Date.now(),
      },
    }));
  },

  resumeWorkoutTimer: () => {
    set((state) => {
      const { workoutTimer } = state;
      if (workoutTimer.startTime && workoutTimer.pausedAt) {
        const pauseDurationMs = Date.now() - workoutTimer.pausedAt;
        const adjustedStartTime = workoutTimer.startTime + pauseDurationMs;
        return {
          workoutTimer: {
            ...workoutTimer,
            startTime: adjustedStartTime,
            paused: false,
            pausedAt: null,
          },
        };
      }
      return {
        workoutTimer: { ...workoutTimer, paused: false, pausedAt: null },
      };
    });
  },

  toggleWorkoutTimer: () => {
    const { workoutTimer } = get();
    if (!workoutTimer.paused) {
      // Going from running -> paused
      set({
        workoutTimer: { ...workoutTimer, paused: true, pausedAt: Date.now() },
      });
    } else {
      // Going from paused -> running; adjust startTime so elapsed excludes paused duration
      if (workoutTimer.startTime && workoutTimer.pausedAt) {
        const pauseDurationMs = Date.now() - workoutTimer.pausedAt;
        const adjustedStartTime = workoutTimer.startTime + pauseDurationMs;
        set({
          workoutTimer: {
            ...workoutTimer,
            paused: false,
            pausedAt: null,
            startTime: adjustedStartTime,
          },
        });
      } else {
        set({
          workoutTimer: { ...workoutTimer, paused: false, pausedAt: null },
        });
      }
    }
  },

  stopWorkoutTimer: () => {
    const { workoutTimer } = get();

    // clear the interval to prevent memory leaks
    if (workoutTimer.intervalId) {
      clearInterval(workoutTimer.intervalId);
    }

    set({
      workoutTimer: {
        startTime: null,
        elapsedSeconds: 0,
        paused: false,
        intervalId: null,
        pausedAt: null,
      },
    });
  },

  getFormattedWorkoutTime: () => {
    const { workoutTimer } = get();
    return formatTime(workoutTimer.elapsedSeconds);
  },
  rehydrateWorkoutTimer: () => {
    // Normalize persisted values to epoch ms, recompute elapsed, and (re)start interval if needed
    set((state) => {
      const t = state.workoutTimer;
      const startTime: number | null = (() => {
        const s: any = t.startTime as any;
        if (typeof s === "number") return s;
        if (typeof s === "string") {
          const ms = new Date(s).getTime();
          return isNaN(ms) ? null : ms;
        }
        if (s && typeof s === "object" && typeof s.getTime === "function") {
          const ms = (s as Date).getTime();
          return isNaN(ms) ? null : ms;
        }
        return null;
      })();

      const pausedAt: number | null = (() => {
        const p: any = t.pausedAt as any;
        if (typeof p === "number") return p;
        if (typeof p === "string") {
          const ms = new Date(p).getTime();
          return isNaN(ms) ? null : ms;
        }
        if (p && typeof p === "object" && typeof p.getTime === "function") {
          const ms = (p as Date).getTime();
          return isNaN(ms) ? null : ms;
        }
        return null;
      })();

      let elapsedSeconds = 0;
      if (typeof startTime === "number") {
        if (t.paused) {
          const endMs = typeof pausedAt === "number" ? pausedAt : Date.now();
          elapsedSeconds = Math.max(0, Math.floor((endMs - startTime) / 1000));
        } else {
          elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        }
      }

      const next: WorkoutTimer = { ...t, startTime, pausedAt, elapsedSeconds } as WorkoutTimer;

      // If running and no interval, start ticking
      if (!next.paused && next.startTime && !next.intervalId) {
        const intervalId = window.setInterval(() => {
          set((inner) => {
            const wt = inner.workoutTimer;
            if (!wt.paused && wt.startTime) {
              const elapsed = Math.floor((Date.now() - wt.startTime) / 1000);
              return {
                workoutTimer: {
                  ...wt,
                  elapsedSeconds: elapsed,
                },
              };
            }
            return inner;
          });
        }, 1000);
        next.intervalId = intervalId;
      }

      return { workoutTimer: next };
    });
  },
}),
    {
      name: "ui-store",
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({
        isDrawerOpen: state.isDrawerOpen,
        workoutTimer: {
          ...state.workoutTimer,
          // Do not persist interval id
          intervalId: null,
        },
      }),
      onRehydrateStorage: () => (state) => {
        // After state is loaded, fix dates and start/stop interval
        state?.rehydrateWorkoutTimer();
      },
    },
  ),
);
