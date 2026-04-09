import { type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { scrollPrimaryContentToTop } from "@/shared/navigation";

const isPlainLeftClick = (event: MouseEvent<HTMLElement>) =>
  event.button === 0
  && !event.metaKey
  && !event.altKey
  && !event.ctrlKey
  && !event.shiftKey;

export const useHomeNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === NAV_PATHS.WORKOUTS;

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (!isPlainLeftClick(event)) {
      return;
    }

    event.preventDefault();

    if (isHome) {
      scrollPrimaryContentToTop();
      return;
    }

    navigate(NAV_PATHS.WORKOUTS);
  };

  return {
    href: NAV_PATHS.WORKOUTS,
    handleClick,
  };
};
