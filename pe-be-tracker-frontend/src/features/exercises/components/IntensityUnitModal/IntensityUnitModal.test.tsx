import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import * as exerciseApi from "@/features/exercises/api";
import { render, screen, waitFor } from "@/test/testUtils";

import IntensityUnitModal from "./IntensityUnitModal";

const mockIsAuthenticated = vi.fn();

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      isAuthenticated: mockIsAuthenticated(),
      user: null,
    };

    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/features/exercises/api", () => ({
  getIntensityUnits: vi.fn(),
}));

const mockGetIntensityUnits = vi.mocked(exerciseApi.getIntensityUnits);

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSelect: vi.fn(),
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const TestWrapper = ({
  children,
  queryClient = createTestQueryClient(),
}: {
  children: ReactNode;
  queryClient?: QueryClient;
}) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("IntensityUnitModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(false);
  });

  it("does not render when closed", () => {
    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} isOpen={false} />
      </TestWrapper>,
    );

    expect(
      screen.queryByRole("heading", { name: /select intensity unit/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("intensity-unit-modal"),
    ).not.toBeInTheDocument();
  });

  it("renders the shared dialog header copy", () => {
    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} />
      </TestWrapper>,
    );

    expect(
      screen.getByRole("heading", { name: /select intensity unit/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose the unit you want to use for this set."),
    ).toBeInTheDocument();
  });

  it("shows guest units as selection cards", () => {
    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} />
      </TestWrapper>,
    );

    expect(
      screen.getByRole("button", { name: /select bodyweight \(bw\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("BW")).toBeInTheDocument();
    expect(screen.getByText("Bodyweight")).toBeInTheDocument();
    expect(screen.getByText("Your own body weight")).toBeInTheDocument();
    expect(screen.getByText("Metric load")).toBeInTheDocument();
    expect(screen.getByText("Imperial load")).toBeInTheDocument();
  });

  it("calls onSelect with the chosen guest unit", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} onSelect={onSelect} />
      </TestWrapper>,
    );

    await user.click(
      screen.getByRole("button", { name: /select bodyweight \(bw\)/i }),
    );

    expect(onSelect).toHaveBeenCalledWith({
      id: 5,
      name: "Bodyweight",
      abbreviation: "BW",
    });
  });

  it("does not fetch server units in guest mode", () => {
    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} />
      </TestWrapper>,
    );

    expect(mockGetIntensityUnits).not.toHaveBeenCalled();
  });

  it("shows loading skeletons in authenticated mode", () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetIntensityUnits.mockImplementation(() => new Promise(() => {}));

    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} />
      </TestWrapper>,
    );

    const skeletons = document.querySelectorAll(".h-24.animate-pulse");
    expect(skeletons).toHaveLength(4);
  });

  it("renders server units when loaded", async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetIntensityUnits.mockResolvedValue([
      { id: 1, name: "Kilograms", abbreviation: "kg" },
      { id: 2, name: "Pounds", abbreviation: "lbs" },
      { id: 3, name: "Reps", abbreviation: "reps" },
    ]);

    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /select kilograms \(kg\)/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /select reps \(reps\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Rep-based effort")).toBeInTheDocument();
  });

  it("calls onSelect with the chosen server unit", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    mockIsAuthenticated.mockReturnValue(true);
    mockGetIntensityUnits.mockResolvedValue([
      { id: 1, name: "Kilograms", abbreviation: "kg" },
    ]);

    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} onSelect={onSelect} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /select kilograms \(kg\)/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /select kilograms \(kg\)/i }),
    );

    expect(onSelect).toHaveBeenCalledWith({
      id: 1,
      name: "Kilograms",
      abbreviation: "kg",
    });
  });

  it("shows the error state when loading units fails", async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetIntensityUnits.mockRejectedValue(new Error("API Error"));

    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load intensity units."),
      ).toBeInTheDocument();
    });
  });

  it("closes from the dialog close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} onClose={onClose} />
      </TestWrapper>,
    );

    await user.click(screen.getByRole("button", { name: /close modal/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the option buttons accessible", () => {
    render(
      <TestWrapper>
        <IntensityUnitModal {...defaultProps} />
      </TestWrapper>,
    );

    expect(
      screen.getByRole("button", { name: /select bodyweight \(bw\)/i }),
    ).toHaveAttribute("aria-label", "Select Bodyweight (BW)");
    expect(
      screen.getByRole("button", { name: /select kilograms \(kg\)/i }),
    ).toHaveAttribute("aria-label", "Select Kilograms (KG)");
  });
});
