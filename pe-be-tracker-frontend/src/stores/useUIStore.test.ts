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
    expect(st.intervalId).toBeNull();
    expect(st.elapsedSeconds).toBe(120);

    // Advance time; elapsed should remain frozen while paused
    vi.advanceTimersByTime(5000);
    expect(reloadedStore.getState().workoutTimer.elapsedSeconds).toBe(120);
  });
});
