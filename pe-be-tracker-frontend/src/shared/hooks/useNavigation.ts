import { type MouseEvent, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNavigationStore } from "@/stores/useNavigationStore";
import {
  getNavigationSectionByKey,
  getNavigationSectionForPath,
  scrollPrimaryContentToTop,
} from "@/shared/navigation";
import { type NavKey } from "@/shared/navigation/constants";

const isPlainLeftClick = (event: MouseEvent<HTMLElement>) =>
  event.button === 0
  && !event.metaKey
  && !event.altKey
  && !event.ctrlKey
  && !event.shiftKey;

export const useNavigation = (navKey: NavKey) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setLastVisitedPath, getLastVisitedPath } = useNavigationStore();
  const section = getNavigationSectionByKey(navKey);

  if (!section) {
    throw new Error(`Unknown navigation section for key "${navKey}"`);
  }

  const activeSection = getNavigationSectionForPath(location.pathname);
  const isActive = activeSection?.key === navKey;

  useEffect(() => {
    if (section.matchesPath(location.pathname)) {
      setLastVisitedPath(navKey, section.sanitizePath(location.pathname));
    }
  }, [location.pathname, navKey, section, setLastVisitedPath]);

  const targetPath = section.sanitizePath(
    getLastVisitedPath(navKey, section.rootPath),
  );

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (!isPlainLeftClick(event)) {
      return;
    }

    event.preventDefault();

    if (!isActive) {
      navigate(targetPath);
      return;
    }

    if (!section.isRootPath(location.pathname)) {
      navigate(section.rootPath, { replace: true });
      return;
    }

    scrollPrimaryContentToTop();
  };

  return {
    href: isActive ? section.rootPath : targetPath,
    isActive,
    handleClick,
  };
};
