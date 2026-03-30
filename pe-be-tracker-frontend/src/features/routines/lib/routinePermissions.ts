import type { Routine } from "@/features/routines/types";

type RoutineEditAccessArgs = {
  currentUserId?: number | null;
  isAuthenticated: boolean;
  isSuperuser?: boolean;
  routine: Routine | null;
};

export const canEditRoutine = ({
  currentUserId,
  isSuperuser = false,
  routine,
}: RoutineEditAccessArgs): boolean => {
  if (!routine) {
    return false;
  }

  if (isSuperuser) {
    return true;
  }

  return routine.creator_id === currentUserId;
};

export const getRoutineEditAccessMessage = ({
  currentUserId,
  isAuthenticated,
  isSuperuser = false,
  routine,
}: RoutineEditAccessArgs): string | null => {
  if (
    !routine ||
    canEditRoutine({
      currentUserId,
      isAuthenticated,
      isSuperuser,
      routine,
    })
  ) {
    return null;
  }

  if (!isAuthenticated) {
    return "Sign in as the routine creator or a superuser to edit this routine.";
  }

  return "Only the routine creator or a superuser can edit this routine.";
};
