import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigationStore } from '@/stores/useNavigationStore';

export const useNavigation = (navKey: string, defaultPath: string) => {
  const location = useLocation();
  const { setLastVisitedPath, getLastVisitedPath } = useNavigationStore();

  useEffect(() => {
    if (location.pathname.startsWith(defaultPath)) {
      setLastVisitedPath(navKey, location.pathname);
    }
  }, [location, navKey, defaultPath, setLastVisitedPath]);

  return getLastVisitedPath(navKey, defaultPath);
};