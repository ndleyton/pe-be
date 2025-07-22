import { create } from 'zustand';

interface WorkoutTimer {
  startTime: Date | null;
  elapsedSeconds: number;
  paused: boolean;
  intervalId: number | null;
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
  },

  openDrawer: () => set({ isDrawerOpen: true }),
  
  closeDrawer: () => set({ isDrawerOpen: false }),
  
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

  startWorkoutTimer: (at?: Date) => {
    const startTime = at || new Date();
    const intervalId = window.setInterval(() => {
      const { workoutTimer } = get();
      if (!workoutTimer.paused && workoutTimer.startTime) {
        const elapsed = Math.floor((Date.now() - workoutTimer.startTime.getTime()) / 1000);
        set(state => ({
          workoutTimer: { ...state.workoutTimer, elapsedSeconds: elapsed }
        }));
      }
    }, 1000);

    set({
      workoutTimer: {
        startTime,
        elapsedSeconds: 0,
        paused: false,
        intervalId,
      }
    });
  },

  pauseWorkoutTimer: () => {
    set(state => ({
      workoutTimer: { ...state.workoutTimer, paused: true }
    }));
  },

  resumeWorkoutTimer: () => {
    set(state => ({
      workoutTimer: { ...state.workoutTimer, paused: false }
    }));
  },

  toggleWorkoutTimer: () => {
    const { workoutTimer } = get();
    set({
      workoutTimer: { ...workoutTimer, paused: !workoutTimer.paused }
    });
  },

  stopWorkoutTimer: () => {
    const { workoutTimer } = get();
    if (workoutTimer.intervalId) {
      clearInterval(workoutTimer.intervalId);
    }
    set({
      workoutTimer: {
        startTime: null,
        elapsedSeconds: 0,
        paused: false,
        intervalId: null,
      }
    });
  },

  getFormattedWorkoutTime: () => {
    const { workoutTimer } = get();
    return formatTime(workoutTimer.elapsedSeconds);
  },
}));