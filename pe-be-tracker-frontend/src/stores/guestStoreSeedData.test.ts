import { describe, expect, it } from "vitest";
import { createInitialGuestData } from "./guestStoreSeedData";

const makeIdGenerator = () => {
  let counter = 0;
  return () => `generated-id-${counter++}`;
};

describe("createInitialGuestData", () => {
  it("builds seeded guest data without store state", () => {
    const data = createInitialGuestData(makeIdGenerator());

    expect(data.workouts).toEqual([]);
    expect(data.exerciseTypes.length).toBeGreaterThan(0);
    expect(data.workoutTypes.length).toBeGreaterThan(0);
  });
});
