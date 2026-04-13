export const scheduleIdleTask = (
  task: () => void,
  timeout = 2000,
): (() => void) => {
  if (typeof window === "undefined") {
    task();
    return () => {};
  }

  const browserWindow = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

  if (typeof browserWindow.requestIdleCallback === "function") {
    const idleId = browserWindow.requestIdleCallback(task, { timeout });
    return () => browserWindow.cancelIdleCallback?.(idleId);
  }

  const timeoutId = globalThis.setTimeout(task, 0);
  return () => globalThis.clearTimeout(timeoutId);
};
