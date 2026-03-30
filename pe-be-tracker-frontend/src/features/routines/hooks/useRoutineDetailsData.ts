import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getIntensityUnits } from "@/features/exercises/api";
import { getRoutine } from "@/features/routines/api";
import {
  guestIntensityUnits,
  type RoutineIntensityUnitOption,
} from "@/features/routines/lib/routineEditor";
import {
  canEditRoutine,
  getRoutineEditAccessMessage,
} from "@/features/routines/lib/routinePermissions";
import { useAuthStore } from "@/stores";

export const useRoutineDetailsData = (routineId: string | undefined) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUser = useAuthStore((state) => state.user);
  const canFetchServerRoutine = routineId != null && /^\d+$/.test(routineId);

  const {
    data: serverRoutine,
    isPending: routinePending,
    error: routineError,
  } = useQuery({
    queryKey: ["routine", routineId],
    queryFn: () => getRoutine(Number(routineId)),
    enabled: canFetchServerRoutine,
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
    return serverRoutine ?? null;
  }, [serverRoutine]);

  const canEdit = useMemo(
    () =>
      canEditRoutine({
        currentUserId: currentUser?.id,
        isAuthenticated,
        isSuperuser: currentUser?.is_superuser,
        routine,
      }),
    [
      currentUser?.id,
      currentUser?.is_superuser,
      isAuthenticated,
      routine,
    ],
  );

  const editAccessMessage = useMemo(
    () =>
      getRoutineEditAccessMessage({
        currentUserId: currentUser?.id,
        isAuthenticated,
        isSuperuser: currentUser?.is_superuser,
        routine,
      }),
    [
      currentUser?.id,
      currentUser?.is_superuser,
      isAuthenticated,
      routine,
    ],
  );

  return {
    availableIntensityUnits,
    canEdit,
    editAccessMessage,
    isAuthenticated,
    routine,
    routineError,
    routinePending: canFetchServerRoutine ? routinePending : false,
    unitsPending,
  };
};
