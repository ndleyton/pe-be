import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigationStore } from '@/stores/useNavigationStore';

export const useNavigation = (navKey: string, defaultPath: string) => {
  const location = useLocation();
  const { setLastVisitedPath, getLastVisitedPath } = useNavigationStore();

  useEffect(() => {
    // Handle special case for workouts section - match both /workouts and /workout/:id
    if (navKey === 'workouts') {
      if (location.pathname === '/workouts' || location.pathname.startsWith('/workout/')) {
        setLastVisitedPath(navKey, location.pathname);
      }
    } else if (location.pathname.startsWith(defaultPath)) {
      setLastVisitedPath(navKey, location.pathname);
    }
  }, [location, navKey, defaultPath, setLastVisitedPath]);

  return getLastVisitedPath(navKey, defaultPath);
};