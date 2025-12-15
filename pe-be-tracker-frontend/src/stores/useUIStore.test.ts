import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("useUIStore persistence and rehydration", () => {
  const baseNow = new Date("2024-01-01T00:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    // Ensure localStorage fallback is clean
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    // Ensure any scheduled timers/intervals from the store are cleared
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("rehydrates a running timer and continues ticking", async () => {
    // Seed persisted state directly (simulating a previous session)
    const persisted = {
      state: {
        isDrawerOpen: false,
        workoutTimer: {
          startTime: new Date(baseNow - 90 * 1000).toISOString(),
          elapsedSeconds: 0,
          paused: false,
          intervalId: null,
          pausedAt: null,
        },
      },
      version: 0,
    };
    localStorage.setItem("ui-store", JSON.stringify(persisted));

    // Load store so it rehydrates from storage
    const { useUIStore: reloadedStore } = await import("./useUIStore");
    // Wait for hydration to complete
    if (!reloadedStore.persist.hasHydrated()) {
      await new Promise<void>((resolve) => {
        const unsub = reloadedStore.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
      });
    }

    const state = reloadedStore.getState().workoutTimer;
    expect(typeof state.startTime).toBe("number");
    expect(state.paused).toBe(false);
    expect(state.elapsedSeconds).toBe(90);
    expect(state.intervalId).not.toBeNull();

    // Advance 5s and ensure it updates
    vi.advanceTimersByTime(5000);
    expect(reloadedStore.getState().workoutTimer.elapsedSeconds).toBe(95);
  });


  it("rehydrates a paused timer and keeps elapsed frozen", async () => {
    const persisted = {
      state: {
        isDrawerOpen: false,
        workoutTimer: {
          startTime: new Date(baseNow - 120 * 1000).toISOString(),
          elapsedSeconds: 999, // arbitrary; should be recomputed on rehydrate
          paused: true,
          intervalId: null,
          pausedAt: new Date(baseNow).toISOString(),
        },
      },
      version: 0,
    };
    localStorage.setItem("ui-store", JSON.stringify(persisted));

    const { useUIStore: reloadedStore } = await import("./useUIStore");
    if (!reloadedStore.persist.hasHydrated()) {
      await new Promise<void>((resolve) => {
        const unsub = reloadedStore.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
      });
    }

    const st = reloadedStore.getState().workoutTimer;
    expect(st.paused).toBe(true);
    expect(typeof st.pausedAt).toBe("number");
    expect(st.elapsedSeconds).toBe(120);

    // Advance time; elapsed should remain frozen while paused
    vi.advanceTimersByTime(5000);
    expect(reloadedStore.getState().workoutTimer.elapsedSeconds).toBe(120);
  });
});

describe("Workout Timer Interactions", () => {
  const baseNow = new Date("2024-01-01T10:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("starts the timer and ticks", async () => {
    const { useUIStore } = await import("./useUIStore");
    const store = useUIStore.getState();

    store.startWorkoutTimer();

    // Immediately after start, elapsed should be 0
    expect(useUIStore.getState().workoutTimer.elapsedSeconds).toBe(0);
    expect(useUIStore.getState().workoutTimer.startTime).toBe(baseNow);
    expect(useUIStore.getState().workoutTimer.intervalId).not.toBeNull();

    // Advance 1s
    vi.advanceTimersByTime(1000);
    expect(useUIStore.getState().workoutTimer.elapsedSeconds).toBe(1);

    // Advance 5 more seconds
    vi.advanceTimersByTime(5000);
    expect(useUIStore.getState().workoutTimer.elapsedSeconds).toBe(6);
  });

  it("pauses the timer and freezes elapsed time", async () => {
    const { useUIStore } = await import("./useUIStore");
    const store = useUIStore.getState();

    store.startWorkoutTimer();
    vi.advanceTimersByTime(10000); // 10s running
    expect(useUIStore.getState().workoutTimer.elapsedSeconds).toBe(10);

    // Pause
    useUIStore.getState().pauseWorkoutTimer();
    const pausedState = useUIStore.getState().workoutTimer;
    expect(pausedState.paused).toBe(true);
    expect(pausedState.pausedAt).toBe(baseNow + 10000);

    // Advance 5 minutes
    vi.advanceTimersByTime(300000);

    // Elapsed should still be 10
    expect(useUIStore.getState().workoutTimer.elapsedSeconds).toBe(10);
  });

  it("resumes the timer and correctly shifts start time (The Math Check)", async () => {
    const { useUIStore } = await import("./useUIStore");
    const store = useUIStore.getState();

    // 1. Start at 10:00:00
    store.startWorkoutTimer();

    // 2. Run for 10 seconds -> 10:00:10
    vi.advanceTimersByTime(10000);
    expect(useUIStore.getState().workoutTimer.elapsedSeconds).toBe(10);

    // 3. Pause
    useUIStore.getState().pauseWorkoutTimer();

    // 4. Wait 20 seconds -> 10:00:30
    vi.advanceTimersByTime(20000);
    expect(useUIStore.getState().workoutTimer.elapsedSeconds).toBe(10);

    // 5. Resume
    useUIStore.getState().resumeWorkoutTimer();

    const stateAfterResume = useUIStore.getState().workoutTimer;
    expect(stateAfterResume.paused).toBe(false);
    expect(stateAfterResume.pausedAt).toBeNull();

    // Expected logic:
    // Original Start: 10:00:00 (baseNow)
    // Paused At: 10:00:10
    // Resumed At: 10:00:30
    // Pause Duration: 20s
    // New Start Time = Original Start + 20s = 10:00:20
    // Current Time: 10:00:30
    // Elapsed = 10:00:30 - 10:00:20 = 10s. Correct!

    expect(stateAfterResume.startTime).toBe(baseNow + 20000);

    // 6. Tick 5 more seconds -> 10:00:35
    vi.advanceTimersByTime(5000);
    expect(useUIStore.getState().workoutTimer.elapsedSeconds).toBe(15);
  });

  it("stops the timer and resets state", async () => {
    const { useUIStore } = await import("./useUIStore");
    const store = useUIStore.getState();

    store.startWorkoutTimer();
    vi.advanceTimersByTime(5000);

    useUIStore.getState().stopWorkoutTimer();

    const stoppedState = useUIStore.getState().workoutTimer;
    expect(stoppedState.startTime).toBeNull();
    expect(stoppedState.elapsedSeconds).toBe(0);
    expect(stoppedState.paused).toBe(false);
    expect(stoppedState.intervalId).toBeNull();
  });

  it("toggles between pause and resume", async () => {
    const { useUIStore } = await import("./useUIStore");
    const store = useUIStore.getState();

    store.startWorkoutTimer();
    vi.advanceTimersByTime(1000);

    // Toggle -> Pause
    useUIStore.getState().toggleWorkoutTimer();
    expect(useUIStore.getState().workoutTimer.paused).toBe(true);

    vi.advanceTimersByTime(5000);

    // Toggle -> Resume
    useUIStore.getState().toggleWorkoutTimer();
    expect(useUIStore.getState().workoutTimer.paused).toBe(false);

    // Should have only 1s elapsed roughly (+5s tick hasn't happened yet immediately)
    // Let's tick 1s to see progress
    vi.advanceTimersByTime(1000);
    expect(useUIStore.getState().workoutTimer.elapsedSeconds).toBe(2);
  });
});
