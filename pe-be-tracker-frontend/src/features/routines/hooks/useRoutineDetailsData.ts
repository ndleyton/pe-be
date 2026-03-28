import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getIntensityUnits } from "@/features/exercises/api";
import { getRoutine } from "@/features/routines/api";
import {
  guestIntensityUnits,
  toRoutineFromGuest,
  type RoutineIntensityUnitOption,
} from "@/features/routines/lib/routineEditor";
import { useAuthStore, useGuestStore } from "@/stores";

export const useRoutineDetailsData = (routineId: string | undefined) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const guestRoutine = useGuestStore((state) =>
    state.routines.find((routine) => routine.id === routineId),
  );

  const {
    data: serverRoutine,
    isPending: routinePending,
    error: routineError,
  } = useQuery({
    queryKey: ["routine", routineId],
    queryFn: () => getRoutine(Number(routineId)),
    enabled: isAuthenticated && !!routineId,
  });

  const {
    data: serverIntensityUnits = [],
    isPending: unitsPending,
  } = useQuery({
    queryKey: ["intensityUnits"],
    queryFn: getIntensityUnits,
    enabled: isAuthenticated,
  });

  const availableIntensityUnits = useMemo<RoutineIntensityUnitOption[]>(
    () =>
      isAuthenticated
        ? serverIntensityUnits.map((unit) => ({
            id: unit.id,
            name: unit.name,
            abbreviation: unit.abbreviation,
          }))
        : guestIntensityUnits,
    [isAuthenticated, serverIntensityUnits],
  );

  const routine = useMemo(() => {
    if (isAuthenticated) {
      return serverRoutine ?? null;
    }

    if (!guestRoutine) {
      return null;
    }

    return toRoutineFromGuest(guestRoutine);
  }, [guestRoutine, isAuthenticated, serverRoutine]);

  return {
    availableIntensityUnits,
    guestRoutine,
    isAuthenticated,
    routine,
    routineError,
    routinePending,
    unitsPending,
  };
};
