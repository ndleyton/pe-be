import { create } from 'zustand';

interface UIState {
  isDrawerOpen: boolean;
}

interface UIActions {
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set) => ({
  isDrawerOpen: false,

  openDrawer: () => set({ isDrawerOpen: true }),
  
  closeDrawer: () => set({ isDrawerOpen: false }),
  
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
}));