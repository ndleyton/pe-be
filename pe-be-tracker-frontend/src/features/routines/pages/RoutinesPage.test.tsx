import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";

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

describe("RoutinesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStartWorkoutFromRoutine.mockReturnValue(vi.fn());
  });

  it("renders routine card skeletons while routines are pending", () => {
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
    expect(screen.getByPlaceholderText(/search routines/i)).toBeInTheDocument();
    expect(container.querySelector(".loading-spinner")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("keeps the page shell mounted when routines fail to load", () => {
    const failedRoutinesQuery = {
      data: [],
      isPending: false,
      isFetched: true,
      isFetchingNextPage: false,
      hasMore: false,
      error: new Error("Failed to load routines"),
      refetch: vi.fn(),
      reset: vi.fn(),
    };
    const programsQuery = {
      data: [],
      isPending: false,
      isFetched: true,
      isFetchingNextPage: false,
      hasMore: false,
      error: null,
      refetch: vi.fn(),
      reset: vi.fn(),
    };
    mockUseInfiniteScroll
      .mockReturnValueOnce(failedRoutinesQuery)
      .mockReturnValueOnce(programsQuery);

    render(<RoutinesPage />);

    expect(
      screen.getByRole("heading", { name: /routines/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search routines/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /programs/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /routines/i })).toBeInTheDocument();
    expect(screen.getByText(/error loading routines/i)).toBeInTheDocument();
  });
});
