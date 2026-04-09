import { describe, expect, it } from "vitest";

import {
  canUpdateDurationInputValue,
  formatDurationInputValue,
  parseDurationInputValue,
  resolveSetValueMode,
} from "./setValue";

describe("setValue", () => {
  it("resolves time mode when a duration is present", () => {
    expect(
      resolveSetValueMode({
        reps: null,
        duration_seconds: 600,
      }),
    ).toBe("time");
  });

  it("falls back to the preferred default when a set is blank", () => {
    expect(
      resolveSetValueMode(
        {
          reps: null,
          duration_seconds: null,
        },
        true,
      ),
    ).toBe("time");
  });

  it("formats duration seconds as MM:SS input text", () => {
    expect(formatDurationInputValue(605)).toBe("10:05");
  });

  it("parses valid MM:SS values into seconds", () => {
    expect(parseDurationInputValue("10:05")).toBe(605);
  });

  it("rejects invalid duration text", () => {
    expect(parseDurationInputValue("10:75")).toBeNull();
    expect(parseDurationInputValue("100")).toBeNull();
  });

  it("accepts partial MM:SS input while typing", () => {
    expect(canUpdateDurationInputValue("")).toBe(true);
    expect(canUpdateDurationInputValue("10")).toBe(true);
    expect(canUpdateDurationInputValue("10:")).toBe(true);
    expect(canUpdateDurationInputValue("10:5")).toBe(true);
    expect(canUpdateDurationInputValue("10:5a")).toBe(false);
  });
});
