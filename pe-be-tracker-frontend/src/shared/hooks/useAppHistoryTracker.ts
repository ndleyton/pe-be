import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { useAppHistoryStore } from "@/stores";

export const useAppHistoryTracker = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const syncEntry = useAppHistoryStore((state) => state.syncEntry);

  useEffect(() => {
    syncEntry(
      {
        key: location.key,
        path: `${location.pathname}${location.search}${location.hash}`,
      },
      navigationType,
    );
  }, [
    location.hash,
    location.key,
    location.pathname,
    location.search,
    navigationType,
    syncEntry,
  ]);
};
