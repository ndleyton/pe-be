import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export const useAppBackNavigation = (fallbackPath: string) => {
  const navigate = useNavigate();

  return useCallback(() => {
    navigate(fallbackPath, { replace: true });
  }, [fallbackPath, navigate]);
};
