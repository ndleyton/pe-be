import type { Routine } from "@/features/routines/types";

type RoutineEditAccessArgs = {
  currentUserId?: number | null;
  isGuestRoutine?: boolean;
  isAuthenticated: boolean;
  isSuperuser?: boolean;
  routine: Routine | null;
};

export const canEditRoutine = ({
  currentUserId,
  isGuestRoutine = false,
  isSuperuser = false,
  routine,
}: RoutineEditAccessArgs): boolean => {
  if (!routine) {
    return false;
  }

  if (isGuestRoutine) {
    return true;
  }

  if (isSuperuser) {
    return true;
  }

  return routine.creator_id === currentUserId;
};

export const getRoutineEditAccessMessage = ({
  currentUserId,
  isGuestRoutine = false,
  isAuthenticated,
  isSuperuser = false,
  routine,
}: RoutineEditAccessArgs): string | null => {
  if (
    !routine ||
    canEditRoutine({
      currentUserId,
      isGuestRoutine,
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
