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
    expect(parseDurationInputValue("1:30")).toBe(90);
  });

  it("parses plain number values as seconds", () => {
    expect(parseDurationInputValue("90")).toBe(90);
    expect(parseDurationInputValue("120")).toBe(120);
  });

  it("parses partial MM:SS values", () => {
    expect(parseDurationInputValue("1:3")).toBe(63);
    expect(parseDurationInputValue(":30")).toBe(30);
    expect(parseDurationInputValue("1:")).toBe(60);
  });

  it("accepts flexible partial input while typing", () => {
    expect(canUpdateDurationInputValue("")).toBe(true);
    expect(canUpdateDurationInputValue("10")).toBe(true);
    expect(canUpdateDurationInputValue("10:")).toBe(true);
    expect(canUpdateDurationInputValue("10:5")).toBe(true);
    expect(canUpdateDurationInputValue(":30")).toBe(true);
    expect(canUpdateDurationInputValue("10:5a")).toBe(false);
  });
});
