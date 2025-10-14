import type { GuestWorkoutType } from "../useGuestStore";

export const buildWorkoutTypes = (
  generateId: () => string,
): GuestWorkoutType[] =>
  [
    {
      id: generateId(),
      name: "Strength Training",
      description: "Traditional weightlifting session",
    },
    {
      id: generateId(),
      name: "Cardio",
      description: "Cardiovascular exercise session",
    },
    {
      id: generateId(),
      name: "Bodyweight",
      description: "Exercises using your own body weight",
    },
    {
      id: "8",
      name: "Other",
      description: "General workout session",
    },
  ] satisfies GuestWorkoutType[];
