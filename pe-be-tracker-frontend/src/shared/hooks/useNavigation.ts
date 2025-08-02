import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { NAV_KEYS, NAV_PATHS, type NavKey } from '@/shared/navigation/constants';

export const useNavigation = (navKey: NavKey, defaultPath: string) => {
  const location = useLocation();
  const { setLastVisitedPath, getLastVisitedPath } = useNavigationStore();

  useEffect(() => {
    // Handle special case for workouts section - match both /workouts and /workout/:id
    if (navKey === NAV_KEYS.WORKOUTS) {
      if (location.pathname === NAV_PATHS.WORKOUTS || location.pathname.startsWith(NAV_PATHS.WORKOUT_DETAIL + '/')) {
        setLastVisitedPath(navKey, location.pathname);
      }
    } else if (location.pathname.startsWith(defaultPath)) {
      setLastVisitedPath(navKey, location.pathname);
    }
  }, [location, navKey, defaultPath, setLastVisitedPath]);

  return getLastVisitedPath(navKey, defaultPath);
};