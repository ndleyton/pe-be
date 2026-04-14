import { describe, expect, it } from "vitest";

import { buildRoutineShareUrl } from "@/features/routines/lib/buildRoutineShareUrl";

describe("buildRoutineShareUrl", () => {
  it("adds a copy-link utm source to share URLs", () => {
    expect(
      buildRoutineShareUrl("https://app.personalbestie.com/routines/42"),
    ).toBe("https://app.personalbestie.com/routines/42?utm_source=copy_link");
  });

  it("preserves existing query params while tagging the copied link", () => {
    expect(
      buildRoutineShareUrl(
        "https://app.personalbestie.com/routines/42?foo=bar&utm_medium=share",
      ),
    ).toBe(
      "https://app.personalbestie.com/routines/42?foo=bar&utm_medium=share&utm_source=copy_link",
    );
  });

  it("replaces any existing utm_source with the copy-link value", () => {
    expect(
      buildRoutineShareUrl(
        "https://app.personalbestie.com/routines/42?utm_source=landing",
      ),
    ).toBe("https://app.personalbestie.com/routines/42?utm_source=copy_link");
  });
});
