import { create } from "zustand";

export interface AppHistoryEntry {
  key: string;
  path: string;
}

interface AppHistoryState {
  entries: AppHistoryEntry[];
  syncEntry: (
    entry: AppHistoryEntry,
    action: "POP" | "PUSH" | "REPLACE",
  ) => void;
  reset: () => void;
}

export const useAppHistoryStore = create<AppHistoryState>()((set) => ({
  entries: [],
  syncEntry: (entry, action) =>
    set((state) => {
      if (state.entries.length === 0) {
        return { entries: [entry] };
      }

      const lastEntry = state.entries[state.entries.length - 1];

      if (action === "PUSH") {
        if (lastEntry.key === entry.key) {
          return state;
        }

        return { entries: [...state.entries, entry] };
      }

      if (action === "REPLACE") {
        if (lastEntry.key === entry.key && lastEntry.path === entry.path) {
          return state;
        }

        return {
          entries: [...state.entries.slice(0, -1), entry],
        };
      }

      const existingIndex = state.entries.findIndex((item) => item.key === entry.key);
      if (existingIndex >= 0) {
        return {
          entries: state.entries.slice(0, existingIndex + 1),
        };
      }

      return { entries: [entry] };
    }),
  reset: () => set({ entries: [] }),
}));
