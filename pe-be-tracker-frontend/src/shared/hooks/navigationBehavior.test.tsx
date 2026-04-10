import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Link,
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useAppHistoryStore, useNavigationStore } from "@/stores";
import { NAV_KEYS, NAV_PATHS } from "@/shared/navigation/constants";
import { useAppBackNavigation } from "./useAppBackNavigation";
import { useAppHistoryTracker } from "./useAppHistoryTracker";
import { useHomeNavigation } from "./useHomeNavigation";
import { useNavigation } from "./useNavigation";

const defaultLastVisitedPaths = {
  workouts: NAV_PATHS.WORKOUTS,
  exercises: NAV_PATHS.EXERCISES,
  profile: NAV_PATHS.PROFILE,
  chat: NAV_PATHS.CHAT,
};

const NavigationHarness = ({
  navKey,
  fallbackPath,
}: {
  navKey: (typeof NAV_KEYS)[keyof typeof NAV_KEYS];
  fallbackPath: string;
}) => {
  useAppHistoryTracker();

  const location = useLocation();
  const sectionNavigation = useNavigation(navKey);
  const homeNavigation = useHomeNavigation();
  const handleBack = useAppBackNavigation(fallbackPath);
  const navigate = useNavigate();

  return (
    <div>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="active">{String(sectionNavigation.isActive)}</div>
      <Link to={sectionNavigation.href} onClick={sectionNavigation.handleClick}>
        Section nav
      </Link>
      <Link to={homeNavigation.href} onClick={homeNavigation.handleClick}>
        Home nav
      </Link>
      <button type="button" onClick={handleBack}>
        Back nav
      </button>
      <button type="button" onClick={() => navigate("/exercise-types/42")}>
        Push detail
      </button>
    </div>
  );
};

const renderHarness = ({
  initialEntries,
  navKey,
  fallbackPath,
}: {
  initialEntries: string[];
  navKey: (typeof NAV_KEYS)[keyof typeof NAV_KEYS];
  fallbackPath: string;
}) => {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="*"
          element={<NavigationHarness navKey={navKey} fallbackPath={fallbackPath} />}
        />
      </Routes>
    </MemoryRouter>,
  );
};

describe("navigation behavior", () => {
  beforeEach(() => {
    useNavigationStore.setState({
      lastVisitedPaths: { ...defaultLastVisitedPaths },
    });
    useAppHistoryStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useNavigationStore.setState({
      lastVisitedPaths: { ...defaultLastVisitedPaths },
    });
    useAppHistoryStore.getState().reset();
  });

  it("restores the remembered workouts section path, including routines", async () => {
    const user = userEvent.setup();

    useNavigationStore.setState({
      lastVisitedPaths: {
        ...defaultLastVisitedPaths,
        workouts: "/routines/9",
      },
    });

    renderHarness({
      initialEntries: ["/chat"],
      navKey: NAV_KEYS.WORKOUTS,
      fallbackPath: NAV_PATHS.WORKOUTS,
    });

    expect(screen.getByRole("link", { name: /section nav/i })).toHaveAttribute(
      "href",
      "/routines/9",
    );

    await user.click(screen.getByRole("link", { name: /section nav/i }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/routines/9");
  });

  it("treats routines as part of the workouts section for active state", () => {
    renderHarness({
      initialEntries: ["/routines/9"],
      navKey: NAV_KEYS.WORKOUTS,
      fallbackPath: NAV_PATHS.WORKOUTS,
    });

    expect(screen.getByTestId("active")).toHaveTextContent("true");
  });

  it("resets an active deep tab press to the section root", async () => {
    const user = userEvent.setup();

    renderHarness({
      initialEntries: ["/exercise-types/42"],
      navKey: NAV_KEYS.EXERCISES,
      fallbackPath: NAV_PATHS.EXERCISES,
    });

    await user.click(screen.getByRole("link", { name: /section nav/i }));

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/exercise-types");
    });
  });

  it("scrolls to top when the active root tab is pressed", async () => {
    const user = userEvent.setup();
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    renderHarness({
      initialEntries: ["/workouts"],
      navKey: NAV_KEYS.WORKOUTS,
      fallbackPath: NAV_PATHS.WORKOUTS,
    });

    await user.click(screen.getByRole("link", { name: /section nav/i }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/workouts");
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  it("uses fallback navigation when back is pressed on a direct entry", async () => {
    const user = userEvent.setup();

    renderHarness({
      initialEntries: ["/exercise-types/42"],
      navKey: NAV_KEYS.EXERCISES,
      fallbackPath: NAV_PATHS.EXERCISES,
    });

    await user.click(screen.getByRole("button", { name: /back nav/i }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/exercise-types");
  });

  it("navigates to the parent route instead of the previous history entry", async () => {
    const user = userEvent.setup();
    renderHarness({
      initialEntries: ["/workouts", "/exercise-types/42"],
      navKey: NAV_KEYS.EXERCISES,
      fallbackPath: NAV_PATHS.EXERCISES,
    });

    await user.click(screen.getByRole("button", { name: /back nav/i }));

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/exercise-types");
    });
  });

  it("sends the home action to workouts root from a deep route", async () => {
    const user = userEvent.setup();

    renderHarness({
      initialEntries: ["/exercise-types/42"],
      navKey: NAV_KEYS.EXERCISES,
      fallbackPath: NAV_PATHS.EXERCISES,
    });

    await user.click(screen.getByRole("link", { name: /home nav/i }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/workouts");
  });
});
