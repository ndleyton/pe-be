import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppHistoryStore } from "@/stores";

export const useAppBackNavigation = (fallbackPath: string) => {
  const navigate = useNavigate();
  const canGoBack = useAppHistoryStore((state) => state.entries.length > 1);

  return useCallback(() => {
    if (canGoBack) {
      navigate(-1);
      return;
    }

    navigate(fallbackPath);
  }, [canGoBack, fallbackPath, navigate]);
};
