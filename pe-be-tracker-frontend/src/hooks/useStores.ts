import { useUIStore } from '@/stores/ui';

// Convenience hooks for specific store sections
export const useWorkoutTimer = () => useUIStore((state) => ({
  startTime: state.workoutTimer.startTime,
  elapsedSeconds: state.workoutTimer.elapsedSeconds,
  paused: state.workoutTimer.paused,
  formatted: state.getFormattedWorkoutTime(),
  start: state.startWorkoutTimer,
  pause: state.pauseWorkoutTimer,
  resume: state.resumeWorkoutTimer,
  togglePause: state.toggleWorkoutTimer,
  stop: state.stopWorkoutTimer,
}));

export const useDrawer = () => useUIStore((state) => ({
  isOpen: state.isDrawerOpen,
  openDrawer: state.openDrawer,
  closeDrawer: state.closeDrawer,
  toggleDrawer: state.toggleDrawer,
})); 