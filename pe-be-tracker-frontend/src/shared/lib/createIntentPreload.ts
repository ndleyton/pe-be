export const createIntentPreload = (load: () => Promise<unknown>) => {
  let preloaded = false;

  return () => {
    if (preloaded) return;
    preloaded = true;

    try {
      const result = load();
      void result.catch(() => {
        preloaded = false;
      });
    } catch {
      preloaded = false;
    }
  };
};
