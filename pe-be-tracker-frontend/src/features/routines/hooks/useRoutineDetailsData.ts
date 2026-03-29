import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getIntensityUnits } from "@/features/exercises/api";
import { getRoutine } from "@/features/routines/api";
import {
  guestIntensityUnits,
  toRoutineFromGuest,
  type RoutineIntensityUnitOption,
} from "@/features/routines/lib/routineEditor";
import {
  canEditRoutine,
  getRoutineEditAccessMessage,
} from "@/features/routines/lib/routinePermissions";
import { useAuthStore, useGuestStore } from "@/stores";

export const useRoutineDetailsData = (routineId: string | undefined) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUser = useAuthStore((state) => state.user);

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

  const canEdit = useMemo(
    () =>
      canEditRoutine({
        currentUserId: currentUser?.id,
        isAuthenticated,
        isSuperuser: currentUser?.is_superuser,
        routine,
      }),
    [currentUser?.id, currentUser?.is_superuser, isAuthenticated, routine],
  );

  const editAccessMessage = useMemo(
    () =>
      getRoutineEditAccessMessage({
        currentUserId: currentUser?.id,
        isAuthenticated,
        isSuperuser: currentUser?.is_superuser,
        routine,
      }),
    [currentUser?.id, currentUser?.is_superuser, isAuthenticated, routine],
  );

  return {
    availableIntensityUnits,
    canEdit,
    editAccessMessage,
    guestRoutine,
    isAuthenticated,
    routine,
    routineError,
    routinePending,
    unitsPending,
  };
};
