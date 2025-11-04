import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface WorkoutTimerContextValue {
  /** The time the workout started (null if no workout is active) */
  startTime: Date | null;
  /** Elapsed seconds since the workout started */
  elapsedSeconds: number;
  /** Helper to get a formatted hh:mm:ss string */
  formatted: string;
  /** Whether the timer is currently paused */
  paused: boolean;
  /** Call to pause the timer */
  pause: () => void;
  /** Resume a previously paused timer */
  resume: () => void;
  /** Toggle between pause and resume */
  togglePause: () => void;
  /** Call to stop the timer and reset all state */
  stop: () => void;
  /** Start or restart the timer at an optional time */
  start: (at?: Date) => void;
}

const WorkoutTimerContext = createContext<WorkoutTimerContextValue | undefined>(
  undefined,
);

export const WorkoutTimerProvider = ({ children }: { children: ReactNode }) => {
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedAtRef = useRef<Date | null>(null);
  const totalPausedMsRef = useRef<number>(0);

  // Helper to clear any existing interval
  const clear = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startInterval = () => {
    intervalRef.current = window.setInterval(() => {
      if (!startTime) {
        setElapsedSeconds(0);
        return;
      }
      const totalPausedMs = totalPausedMsRef.current;
      const elapsed = Math.floor(
        (Date.now() - startTime.getTime() - totalPausedMs) / 1000,
      );
      setElapsedSeconds(Math.max(0, elapsed));
    }, 1000);
  };

  const start = (at?: Date) => {
    const startAt = at ?? new Date();
    setStartTime(startAt);
    // reset pause tracking
    totalPausedMsRef.current = 0;
    pausedAtRef.current = null;

    // Calculate elapsed seconds from absolute times (start - total paused)
    const calculatedElapsed = Math.floor(
      (Date.now() - startAt.getTime() - totalPausedMsRef.current) / 1000,
    );
    setElapsedSeconds(Math.max(0, calculatedElapsed));

    clear();
    startInterval();
    setPaused(false);
  };

  const pause = () => {
    if (paused) return;
    clear();
    pausedAtRef.current = new Date();
    setPaused(true);
  };

  const resume = () => {
    if (!paused) return;
    // accumulate paused duration
    if (pausedAtRef.current) {
      totalPausedMsRef.current += Date.now() - pausedAtRef.current.getTime();
      pausedAtRef.current = null;
    }
    setPaused(false);
    startInterval();
  };

  const togglePause = () => {
    paused ? resume() : pause();
  };

  const stop = () => {
    clear();
    setStartTime(null);
    setElapsedSeconds(0);
    setPaused(false);
    pausedAtRef.current = null;
    totalPausedMsRef.current = 0;
  };

  // Clean up when provider unmounts
  useEffect(() => {
    return () => clear();
  }, []);

  const formatted = formatSeconds(elapsedSeconds);

  const value: WorkoutTimerContextValue = {
    startTime,
    elapsedSeconds,
    formatted,
    paused,
    pause,
    resume,
    togglePause,
    stop,
    start,
  };

  return (
    <WorkoutTimerContext.Provider value={value}>
      {children}
    </WorkoutTimerContext.Provider>
  );
};

export const useWorkoutTimer = (): WorkoutTimerContextValue => {
  const ctx = useContext(WorkoutTimerContext);
  if (!ctx) {
    throw new Error(
      "useWorkoutTimer must be used within a WorkoutTimerProvider",
    );
  }
  return ctx;
};

function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
