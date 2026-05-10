import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/testUtils";
import userEvent from "@testing-library/user-event";
import { makeExerciseForSummary } from "@/test/fixtures";
import FinishWorkoutModal from "./FinishWorkoutModal";
import * as imageHelpers from "./lib/workoutSummaryImage";

vi.mock("./lib/workoutSummaryImage", () => ({
  createWorkoutSummaryFile: vi.fn(),
  downloadWorkoutSummaryImage: vi.fn(),
  buildWorkoutSummaryFilename: vi.fn(() => "test-filename.png"),
}));

describe("FinishWorkoutModal Share", () => {
  const mockExercises = [
    makeExerciseForSummary({
      name: "Bench Press",
      muscleGroups: ["Chest"],
      completedSets: 3,
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock navigator.share and canShare
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
      writable: true
    });
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
      writable: true
    });

    // Mock fetch for AnatomicalImage component
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<svg></svg>"),
      }),
    ) as any;
  });

  it("should show share and download buttons when there are completed sets", () => {
    render(<FinishWorkoutModal isOpen={true} exercises={mockExercises} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download workout summary image/i })).toBeInTheDocument();
  });

  it("should hide share and download buttons when there are no completed sets", () => {
    render(<FinishWorkoutModal isOpen={true} exercises={[]} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download workout summary image/i })).not.toBeInTheDocument();
  });

  it("should call navigator.share when share button is clicked and sharing is supported", async () => {
    const user = userEvent.setup();
    const mockFile = new File([""], "test.png", { type: "image/png" });
    vi.mocked(imageHelpers.createWorkoutSummaryFile).mockResolvedValue(mockFile);

    render(<FinishWorkoutModal isOpen={true} exercises={mockExercises} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(imageHelpers.createWorkoutSummaryFile).toHaveBeenCalled();
    expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({
      files: [mockFile],
    }));
  });

  it("should fall back to download when navigator.canShare returns false", async () => {
    const user = userEvent.setup();
    const mockFile = new File([""], "test.png", { type: "image/png" });
    vi.mocked(imageHelpers.createWorkoutSummaryFile).mockResolvedValue(mockFile);
    vi.mocked(navigator.canShare).mockReturnValue(false);

    render(<FinishWorkoutModal isOpen={true} exercises={mockExercises} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(navigator.share).not.toHaveBeenCalled();
    expect(imageHelpers.downloadWorkoutSummaryImage).toHaveBeenCalledWith(mockFile);
  });

  it("should fall back to download when navigator.share fails (not AbortError)", async () => {
    const user = userEvent.setup();
    const mockFile = new File([""], "test.png", { type: "image/png" });
    vi.mocked(imageHelpers.createWorkoutSummaryFile).mockResolvedValue(mockFile);
    vi.mocked(navigator.share).mockRejectedValue(new Error("Share failed"));
    // Mock alert
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<FinishWorkoutModal isOpen={true} exercises={mockExercises} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(alertMock).toHaveBeenCalledWith("Failed to share workout summary. Downloading instead.");
    // It calls handleDownload which eventually calls downloadWorkoutSummaryImage
    expect(imageHelpers.downloadWorkoutSummaryImage).toHaveBeenCalled();

    alertMock.mockRestore();
  });

  it("should NOT fall back to download when navigator.share fails with AbortError", async () => {
    const user = userEvent.setup();
    const mockFile = new File([""], "test.png", { type: "image/png" });
    vi.mocked(imageHelpers.createWorkoutSummaryFile).mockResolvedValue(mockFile);
    const abortError = new Error("AbortError");
    abortError.name = "AbortError";
    vi.mocked(navigator.share).mockRejectedValue(abortError);

    render(<FinishWorkoutModal isOpen={true} exercises={mockExercises} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(imageHelpers.downloadWorkoutSummaryImage).not.toHaveBeenCalled();
  });
});
