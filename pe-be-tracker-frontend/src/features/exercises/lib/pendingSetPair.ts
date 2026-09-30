import type { createExerciseSetPair } from "@/features/exercises/api";

type PendingPair = {
  key: string;
  sets: Parameters<typeof createExerciseSetPair>[1];
  // Sides the user deleted before the pair was confirmed. Kept with the
  // operation so a replay after a lost response deletes them instead of
  // resurrecting them.
  deletedSides?: string[];
};

const storageKey = (userId: number, exerciseId: string | number) =>
  `pending-set-pair:${userId}:${exerciseId}`;

// Write before sending: if storage is unavailable, do not start an operation
// whose identity would be lost on reload. Failed requests keep this record.
export const getOrCreatePendingPair = (
  userId: number,
  exerciseId: string | number,
  sets: PendingPair["sets"],
): PendingPair => {
  const key = storageKey(userId, exerciseId);
  const saved = localStorage.getItem(key);
  if (saved) return JSON.parse(saved) as PendingPair;
  const pending = { key: crypto.randomUUID(), sets };
  localStorage.setItem(key, JSON.stringify(pending));
  return pending;
};

export const clearPendingPair = (userId: number, exerciseId: string | number) => {
  localStorage.removeItem(storageKey(userId, exerciseId));
};

export const markPendingPairSideDeleted = (
  userId: number,
  exerciseId: string | number,
  operationKey: string,
  side: string,
) => {
  const key = storageKey(userId, exerciseId);
  const saved = localStorage.getItem(key);
  if (!saved) return;
  const pending = JSON.parse(saved) as PendingPair;
  if (pending.key !== operationKey) return;
  const deletedSides = new Set(pending.deletedSides ?? []);
  deletedSides.add(side);
  localStorage.setItem(
    key,
    JSON.stringify({ ...pending, deletedSides: [...deletedSides] }),
  );
};
