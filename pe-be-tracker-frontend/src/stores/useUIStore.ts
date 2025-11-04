import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createIndexedDBStorage } from "./indexedDBStorage";

interface WorkoutTimer {
  startTime: Date | null;
  elapsedSeconds: number;
  paused: boolean;
  intervalId: number | null;
  /** Timestamp when the timer was paused. Used to adjust startTime on resume */
  pausedAt: Date | null;
}

interface UIState {
  isDrawerOpen: boolean;
  workoutTimer: WorkoutTimer;
}

interface UIActions {
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  startWorkoutTimer: (at?: Date) => void;
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

  startWorkoutTimer: (at?: Date) => {
    const { workoutTimer } = get();

    // Clear any existing interval to prevent memory leaks
    if (workoutTimer.intervalId) {
      clearInterval(workoutTimer.intervalId);
    }

    const startTime = at || new Date();
    const intervalId = window.setInterval(() => {
      // Use functional state update to avoid stale closure issues
      set((state) => {
        const { workoutTimer } = state;
        if (!workoutTimer.paused && workoutTimer.startTime) {
          const elapsed = Math.floor(
            (Date.now() - workoutTimer.startTime.getTime()) / 1000,
          );
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
        startTime,
        elapsedSeconds: Math.max(
          0,
          Math.floor((Date.now() - startTime.getTime()) / 1000),
        ),
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
        pausedAt: new Date(),
      },
    }));
  },

  resumeWorkoutTimer: () => {
    set((state) => {
      const { workoutTimer } = state;
      if (workoutTimer.startTime && workoutTimer.pausedAt) {
        const pauseDurationMs = Date.now() - workoutTimer.pausedAt.getTime();
        const adjustedStartTime = new Date(
          workoutTimer.startTime.getTime() + pauseDurationMs,
        );
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
        workoutTimer: { ...workoutTimer, paused: true, pausedAt: new Date() },
      });
    } else {
      // Going from paused -> running; adjust startTime so elapsed excludes paused duration
      if (workoutTimer.startTime && workoutTimer.pausedAt) {
        const pauseDurationMs = Date.now() - workoutTimer.pausedAt.getTime();
        const adjustedStartTime = new Date(
          workoutTimer.startTime.getTime() + pauseDurationMs,
        );
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
    // Convert string dates to Date, recompute elapsed, and (re)start interval if needed
    set((state) => {
      const t = state.workoutTimer;
      const startTime =
        typeof (t.startTime as any) === "string"
          ? new Date(t.startTime as any)
          : (t.startTime as Date | null);
      const pausedAt =
        typeof (t.pausedAt as any) === "string"
          ? new Date(t.pausedAt as any)
          : (t.pausedAt as Date | null);

      let elapsedSeconds = 0;
      if (startTime instanceof Date && !isNaN(startTime.getTime())) {
        if (t.paused) {
          const endMs = pausedAt ? pausedAt.getTime() : Date.now();
          elapsedSeconds = Math.max(
            0,
            Math.floor((endMs - startTime.getTime()) / 1000),
          );
        } else {
          elapsedSeconds = Math.max(
            0,
            Math.floor((Date.now() - startTime.getTime()) / 1000),
          );
        }
      }

      const next: WorkoutTimer = {
        ...t,
        startTime,
        pausedAt,
        elapsedSeconds,
      };

      // If running and no interval, start ticking
      if (!next.paused && next.startTime && !next.intervalId) {
        const intervalId = window.setInterval(() => {
          set((inner) => {
            const wt = inner.workoutTimer;
            if (!wt.paused && wt.startTime) {
              const elapsed = Math.floor(
                (Date.now() - wt.startTime.getTime()) / 1000,
              );
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
        workoutTimer: state.workoutTimer,
      }),
      onRehydrateStorage: () => (state) => {
        // After state is loaded, fix dates and start/stop interval
        state?.rehydrateWorkoutTimer();
      },
    },
  ),
);
