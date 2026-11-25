import { describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { act, render, screen } from "@/test/testUtils";
import api from "@/shared/api/client";
import { useAuthStore } from "@/stores";
import PublicActivityPage from "./PublicActivityPage";

const activityPath = "/u/demo/activities/7";

function Destination() {
  const { pathname, search } = useLocation();
  return <p>{pathname}{search}</p>;
}

describe("saving a public activity", () => {
  it.each([true, false])("waits for auth before handling Save (authenticated=%s)", async (isAuthenticated) => {
    useAuthStore.setState({ initialized: false, loading: true, isAuthenticated: false });
    vi.mocked(api.get).mockResolvedValue({ data: { workout_type: { name: "Strength" }, exercises: [] } });
    vi.mocked(api.post).mockResolvedValue({ data: { id: 42 } });
    const user = userEvent.setup();

    render(
      <Routes>
        <Route path="/u/:username/activities/:workoutId" element={<PublicActivityPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>,
      { initialEntries: [activityPath] },
    );

    const save = await screen.findByRole("button", { name: "Save routine" });
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
    act(() => useAuthStore.setState({ initialized: true, loading: false, isAuthenticated }));
    await user.click(save);
    const destination = isAuthenticated ? "/routines/42" : `/login?next=${encodeURIComponent(activityPath)}`;
    expect(await screen.findByText(destination)).toBeVisible();
  });
});
