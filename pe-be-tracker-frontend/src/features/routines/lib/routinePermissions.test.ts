import { describe, expect, it } from "vitest";

import { makeRoutine } from "@/test/fixtures";
import {
  canEditRoutine,
  getRoutineEditAccessMessage,
} from "@/features/routines/lib/routinePermissions";

describe("routinePermissions", () => {
  it("allows the creator to edit a routine", () => {
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

  it("blocks signed-out users from editing a server routine", () => {
    const routine = makeRoutine({
      creator_id: 7,
      visibility: "public",
    });

    expect(
      canEditRoutine({
        currentUserId: null,
        isAuthenticated: false,
        routine,
      }),
    ).toBe(false);
    expect(
      getRoutineEditAccessMessage({
        currentUserId: null,
        isAuthenticated: false,
        routine,
      }),
    ).toBe("Sign in as the routine creator or a superuser to edit this routine.");
  });
});
