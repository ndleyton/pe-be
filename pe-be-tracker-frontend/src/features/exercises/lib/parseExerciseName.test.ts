import { describe, expect, it } from "vitest";
import { parseExerciseName } from "./parseExerciseName";

describe("parseExerciseName", () => {
  it.each(["-", "–", "—"])("separates a spaced %s suffix", (dash) => {
    expect(parseExerciseName(`Barbell Bench Press ${dash} Medium Grip`)).toEqual({
      baseName: "Barbell Bench Press", variation: "Medium Grip",
    });
  });

  it("separates a trailing parenthetical variation", () => {
    expect(parseExerciseName("Dumbbell Press (Neutral Grip)")).toEqual({
      baseName: "Dumbbell Press", variation: "Neutral Grip",
    });
  });

  it.each(["Close-Grip Front Lat Pulldown", "Incline Dumbbell Bench Press", "Push-ups", "Press (Machine) Seated", "Press ()"])("preserves ambiguous or undelimited names: %s", (name) => {
    expect(parseExerciseName(name)).toEqual({ baseName: name, variation: null });
  });

  it("preserves additional suffix information", () => {
    expect(parseExerciseName("Bench Press - Close Grip - Paused").variation).toBe("Close Grip - Paused");
  });
});
