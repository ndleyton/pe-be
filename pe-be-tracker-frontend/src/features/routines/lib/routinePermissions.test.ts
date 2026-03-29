import { describe, expect, it } from "vitest";

import { makeRoutine } from "@/test/fixtures";
import {
  canEditRoutine,
  getRoutineEditAccessMessage,
} from "@/features/routines/lib/routinePermissions";

describe("routinePermissions", () => {
  it("allows guests to edit their local routines", () => {
    const routine = makeRoutine();

    expect(
      canEditRoutine({
        currentUserId: null,
        isAuthenticated: false,
        routine,
      }),
    ).toBe(true);
  });

  it("allows the creator to edit a non-readonly routine", () => {
    const routine = makeRoutine({
      creator_id: 42,
      is_readonly: false,
    });

    expect(
      canEditRoutine({
        currentUserId: 42,
        isAuthenticated: true,
        routine,
      }),
    ).toBe(true);
  });

  it("blocks a non-owner from editing a public routine", () => {
    const routine = makeRoutine({
      creator_id: 7,
      is_readonly: false,
      visibility: "public",
    });

    expect(
      canEditRoutine({
        currentUserId: 42,
        isAuthenticated: true,
        routine,
      }),
    ).toBe(false);
    expect(
      getRoutineEditAccessMessage({
        currentUserId: 42,
        isAuthenticated: true,
        routine,
      }),
    ).toBe("Only the routine creator or a superuser can edit this routine.");
  });

  it("allows a superuser to edit any routine", () => {
    const routine = makeRoutine({
      creator_id: 7,
      is_readonly: true,
      visibility: "public",
    });

    expect(
      canEditRoutine({
        currentUserId: 42,
        isAuthenticated: true,
        isSuperuser: true,
        routine,
      }),
    ).toBe(true);
  });

  it("still allows the owner to edit a readonly routine", () => {
    const routine = makeRoutine({
      creator_id: 42,
      is_readonly: true,
    });

    expect(
      canEditRoutine({
        currentUserId: 42,
        isAuthenticated: true,
        routine,
      }),
    ).toBe(true);
  });
});
