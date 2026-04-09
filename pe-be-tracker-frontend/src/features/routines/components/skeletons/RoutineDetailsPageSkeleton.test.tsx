import { describe, expect, it } from "vitest";

import { render } from "@/test/testUtils";

import { RoutineDetailsPageSkeleton } from "./RoutineDetailsPageSkeleton";

describe("RoutineDetailsPageSkeleton", () => {
  it("stacks the template header placeholders before the small breakpoint", () => {
    const { container } = render(<RoutineDetailsPageSkeleton />);

    const wrappers = Array.from(container.querySelectorAll("div"));
    expect(
      wrappers.some((element) => {
        const className = element.className;
        return (
          typeof className === "string" &&
          className.includes("flex-col") &&
          className.includes("items-start") &&
          className.includes("sm:flex-row")
        );
      }),
    ).toBe(true);

    const skeletons = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="skeleton"]'),
    );
    expect(
      skeletons.some((element) => {
        const className = element.className;
        return (
          className.includes("w-full") && className.includes("max-w-[8rem]")
        );
      }),
    ).toBe(true);
  });
});
