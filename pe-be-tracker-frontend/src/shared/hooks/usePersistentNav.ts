
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const usePersistentNav = (navKey: string, defaultPath: string) => {
  const [lastVisited, setLastVisited] = useState(
    localStorage.getItem(navKey) || defaultPath
  );
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith(defaultPath)) {
      setLastVisited(location.pathname);
      localStorage.setItem(navKey, location.pathname);
    }
  }, [location, navKey, defaultPath]);

  return lastVisited;
};

export default usePersistentNav;
