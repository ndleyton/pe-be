import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";

import { render } from "@/test/testUtils";
import RoutinesPage from "./RoutinesPage";
import { useInfiniteScroll } from "@/shared/hooks";
import { useStartWorkoutFromRoutine } from "@/features/routines/hooks";

vi.mock("@/features/routines/components/RoutineStructuredData/RoutineStructuredData", () => ({
  RoutineStructuredData: () => null,
}));

vi.mock("@/features/routines/hooks", () => ({
  useStartWorkoutFromRoutine: vi.fn(),
}));

vi.mock("@/shared/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/shared/hooks")>(
    "@/shared/hooks",
  );

  return {
    ...actual,
    useInfiniteScroll: vi.fn(),
  };
});

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  useAppHistoryStore: (selector: (state: unknown) => unknown) =>
    selector({
      entries: [],
      syncEntry: vi.fn(),
      reset: vi.fn(),
    }),
}));

const mockUseInfiniteScroll = vi.mocked(useInfiniteScroll);
const mockUseStartWorkoutFromRoutine = vi.mocked(useStartWorkoutFromRoutine);

const RoutinesPageWithLocation = () => {
  const location = useLocation();

  return (
    <>
      <RoutinesPage />
      <div data-testid="location">
        {location.pathname}
        {location.search}
      </div>
    </>
  );
};

describe("RoutinesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStartWorkoutFromRoutine.mockReturnValue(vi.fn());
  });

  it("renders program card skeletons by default while programs are pending", () => {
    mockUseInfiniteScroll.mockReturnValue({
      data: [],
      isPending: true,
      isFetched: false,
      isFetchingNextPage: false,
      hasMore: false,
      error: null,
      refetch: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(<RoutinesPage />);

    expect(
      screen.getByRole("heading", { name: /routines/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search programs/i)).toBeInTheDocument();
    expect(container.querySelector(".loading-spinner")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("keeps the page shell mounted when programs fail to load", () => {
    const routinesQuery = {
      data: [],
      isPending: false,
      isFetched: true,
      isFetchingNextPage: false,
      hasMore: false,
      error: null,
      refetch: vi.fn(),
      reset: vi.fn(),
    };
    const failedProgramsQuery = {
      data: [],
      isPending: false,
      isFetched: true,
      isFetchingNextPage: false,
      hasMore: false,
      error: new Error("Failed to load programs"),
      refetch: vi.fn(),
      reset: vi.fn(),
    };
    mockUseInfiniteScroll
      .mockReturnValueOnce(routinesQuery)
      .mockReturnValueOnce(failedProgramsQuery);

    render(<RoutinesPage />);

    expect(
      screen.getByRole("heading", { name: /routines/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search programs/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /programs/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /routines/i })).toBeInTheDocument();
    expect(screen.getByText(/error loading programs/i)).toBeInTheDocument();
  });

  it("places routine creation inside the search control for authenticated users", () => {
    mockUseInfiniteScroll.mockReturnValue({
      data: [],
      isPending: false,
      isFetched: true,
      isFetchingNextPage: false,
      hasMore: false,
      error: null,
      refetch: vi.fn(),
      reset: vi.fn(),
    });

    render(<RoutinesPage />);

    expect(screen.getByPlaceholderText(/search programs/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create routine/i })).toHaveAttribute(
      "href",
      "/routines/new",
    );
  });

  it("selects the programs view from the URL query", () => {
    mockUseInfiniteScroll.mockReturnValue({
      data: [],
      isPending: false,
      isFetched: true,
      isFetchingNextPage: false,
      hasMore: false,
      error: null,
      refetch: vi.fn(),
      reset: vi.fn(),
    });

    render(<RoutinesPage />, {
      initialEntries: ["/routines?view=programs"],
    });

    expect(screen.getByPlaceholderText(/search programs/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no programs available/i),
    ).toBeInTheDocument();
    expect(mockUseInfiniteScroll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ enabled: true }),
    );
  });

  it("selects the routines view from the URL query", () => {
    mockUseInfiniteScroll.mockReturnValue({
      data: [],
      isPending: false,
      isFetched: true,
      isFetchingNextPage: false,
      hasMore: false,
      error: null,
      refetch: vi.fn(),
      reset: vi.fn(),
    });

    render(<RoutinesPage />, {
      initialEntries: ["/routines?view=routines"],
    });

    expect(screen.getByPlaceholderText(/search routines/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no routines available/i),
    ).toBeInTheDocument();
    expect(mockUseInfiniteScroll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ enabled: true }),
    );
  });

  it("writes the selected view to the URL query", async () => {
    const user = userEvent.setup();
    mockUseInfiniteScroll.mockReturnValue({
      data: [],
      isPending: false,
      isFetched: true,
      isFetchingNextPage: false,
      hasMore: false,
      error: null,
      refetch: vi.fn(),
      reset: vi.fn(),
    });

    render(<RoutinesPageWithLocation />, {
      initialEntries: ["/routines?view=routines"],
    });

    await user.click(screen.getByRole("button", { name: /programs/i }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/routines?view=programs",
    );
    expect(screen.getByPlaceholderText(/search programs/i)).toBeInTheDocument();
  });
});
