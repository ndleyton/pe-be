import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
  // Drawer state
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // Theme state (persisted)
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Other UI preferences (persisted)
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Loading states (not persisted)
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;

  // Toast/notification states (not persisted)
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>;
  addNotification: (notification: Omit<UIStore['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Workout Timer state (not persisted)
  workoutTimer: {
    startTime: Date | null;
    elapsedSeconds: number;
    paused: boolean;
    intervalId: number | null;
  };
  startWorkoutTimer: (at?: Date) => void;
  pauseWorkoutTimer: () => void;
  resumeWorkoutTimer: () => void;
  toggleWorkoutTimer: () => void;
  stopWorkoutTimer: () => void;
  // Helper getters
  getFormattedWorkoutTime: () => string;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Drawer state - not persisted
      isDrawerOpen: false,
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

      // Theme state - persisted
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Sidebar state - persisted
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Loading states - not persisted
      globalLoading: false,
      setGlobalLoading: (loading) => set({ globalLoading: loading }),

      // Notifications - not persisted
      notifications: [],
      addNotification: (notification) => {
        const id = Math.random().toString(36).substr(2, 9);
        const timestamp = Date.now();
        set((state) => ({
          notifications: [
            ...state.notifications,
            { ...notification, id, timestamp },
          ],
        }));
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          get().removeNotification(id);
        }, 5000);
      },
      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },
      clearNotifications: () => set({ notifications: [] }),

      // Workout Timer - not persisted
      workoutTimer: {
        startTime: null,
        elapsedSeconds: 0,
        paused: false,
        intervalId: null,
      },

      startWorkoutTimer: (at?: Date) => {
        const startAt = at ?? new Date();
        const calculatedElapsed = Math.floor((Date.now() - startAt.getTime()) / 1000);
        
        // Clear any existing interval
        const { intervalId } = get().workoutTimer;
        if (intervalId !== null) {
          window.clearInterval(intervalId);
        }

        // Start new interval
        const newIntervalId = window.setInterval(() => {
          set((state) => ({
            workoutTimer: {
              ...state.workoutTimer,
              elapsedSeconds: state.workoutTimer.elapsedSeconds + 1,
            },
          }));
        }, 1000);

        set({
          workoutTimer: {
            startTime: startAt,
            elapsedSeconds: Math.max(0, calculatedElapsed),
            paused: false,
            intervalId: newIntervalId,
          },
        });
      },

      pauseWorkoutTimer: () => {
        const { intervalId, paused } = get().workoutTimer;
        if (paused) return;

        if (intervalId !== null) {
          window.clearInterval(intervalId);
        }

        set((state) => ({
          workoutTimer: {
            ...state.workoutTimer,
            paused: true,
            intervalId: null,
          },
        }));
      },

      resumeWorkoutTimer: () => {
        const { paused } = get().workoutTimer;
        if (!paused) return;

        const newIntervalId = window.setInterval(() => {
          set((state) => ({
            workoutTimer: {
              ...state.workoutTimer,
              elapsedSeconds: state.workoutTimer.elapsedSeconds + 1,
            },
          }));
        }, 1000);

        set((state) => ({
          workoutTimer: {
            ...state.workoutTimer,
            paused: false,
            intervalId: newIntervalId,
          },
        }));
      },

      toggleWorkoutTimer: () => {
        const { paused } = get().workoutTimer;
        if (paused) {
          get().resumeWorkoutTimer();
        } else {
          get().pauseWorkoutTimer();
        }
      },

      stopWorkoutTimer: () => {
        const { intervalId } = get().workoutTimer;
        if (intervalId !== null) {
          window.clearInterval(intervalId);
        }

        set({
          workoutTimer: {
            startTime: null,
            elapsedSeconds: 0,
            paused: false,
            intervalId: null,
          },
        });
      },

      getFormattedWorkoutTime: () => {
        const { elapsedSeconds } = get().workoutTimer;
        const hours = Math.floor(elapsedSeconds / 3600);
        const minutes = Math.floor((elapsedSeconds % 3600) / 60);
        const seconds = elapsedSeconds % 60;
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      },
    }),
    {
      name: 'pe-ui-preferences',
      // Only persist user preferences, not transient UI state
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);