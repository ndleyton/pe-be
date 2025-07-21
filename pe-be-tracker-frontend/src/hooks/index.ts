// Export compatibility hooks for migrating from Context to Zustand
export { useAuth } from './useAuth';
export { useGuestData } from './useGuestData';
export { useWorkoutTimer, useDrawer } from './useStores';

// Export existing shared hooks
export { useDebounce } from '@/shared/hooks/useDebounce';
export { useInfiniteScroll } from '@/shared/hooks/useInfiniteScroll'; 