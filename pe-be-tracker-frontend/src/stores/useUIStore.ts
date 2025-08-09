import { create } from 'zustand';

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
}

type UIStore = UIState & UIActions;

const formatTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const useUIStore = create<UIStore>((set, get) => ({
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
      set(state => {
        const { workoutTimer } = state;
        if (!workoutTimer.paused && workoutTimer.startTime) {
          const elapsed = Math.floor((Date.now() - workoutTimer.startTime.getTime()) / 1000);
          return {
            workoutTimer: { 
              ...workoutTimer, 
              elapsedSeconds: elapsed 
            }
          };
        }
        return state;
      });
    }, 1000);

    set({
      workoutTimer: {
        startTime,
        elapsedSeconds: Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)),
        paused: false,
        intervalId,
        pausedAt: null,
      }
    });
  },

  pauseWorkoutTimer: () => {
    set(state => ({
      workoutTimer: { ...state.workoutTimer, paused: true, pausedAt: new Date() }
    }));
  },

  resumeWorkoutTimer: () => {
    set(state => {
      const { workoutTimer } = state;
      if (workoutTimer.startTime && workoutTimer.pausedAt) {
        const pauseDurationMs = Date.now() - workoutTimer.pausedAt.getTime();
        const adjustedStartTime = new Date(workoutTimer.startTime.getTime() + pauseDurationMs);
        return {
          workoutTimer: {
            ...workoutTimer,
            startTime: adjustedStartTime,
            paused: false,
            pausedAt: null,
          }
        };
      }
      return { workoutTimer: { ...workoutTimer, paused: false, pausedAt: null } };
    });
  },

  toggleWorkoutTimer: () => {
    const { workoutTimer } = get();
    if (!workoutTimer.paused) {
      // Going from running -> paused
      set({ workoutTimer: { ...workoutTimer, paused: true, pausedAt: new Date() } });
    } else {
      // Going from paused -> running; adjust startTime so elapsed excludes paused duration
      if (workoutTimer.startTime && workoutTimer.pausedAt) {
        const pauseDurationMs = Date.now() - workoutTimer.pausedAt.getTime();
        const adjustedStartTime = new Date(workoutTimer.startTime.getTime() + pauseDurationMs);
        set({ workoutTimer: { ...workoutTimer, paused: false, pausedAt: null, startTime: adjustedStartTime } });
      } else {
        set({ workoutTimer: { ...workoutTimer, paused: false, pausedAt: null } });
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
      }
    });
  },

  getFormattedWorkoutTime: () => {
    const { workoutTimer } = get();
    return formatTime(workoutTimer.elapsedSeconds);
  },
}));