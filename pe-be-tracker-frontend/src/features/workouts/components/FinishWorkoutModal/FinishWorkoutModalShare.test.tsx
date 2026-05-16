import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/testUtils";
import userEvent from "@testing-library/user-event";
import { makeExerciseForSummary, makeWorkoutPhoto } from "@/test/fixtures";
import FinishWorkoutModal from "./FinishWorkoutModal";
import * as imageHelpers from "./lib/workoutSummaryImage";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

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

  it("should show share button when there are completed sets", () => {
    render(<FinishWorkoutModal isOpen={true} exercises={mockExercises} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("should hide share button when there are no completed sets", () => {
    render(<FinishWorkoutModal isOpen={true} exercises={[]} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
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

    render(<FinishWorkoutModal isOpen={true} exercises={mockExercises} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(toast.error).toHaveBeenCalledWith("Failed to share workout summary. Downloading instead.");
    // It uses the existing file to download
    expect(imageHelpers.downloadWorkoutSummaryImage).toHaveBeenCalledWith(mockFile);
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

  it("includes the uploaded photo in the share/export area on a desktop viewport", async () => {
    const user = userEvent.setup();
    const mockFile = new File([""], "test.png", { type: "image/png" });
    vi.mocked(imageHelpers.createWorkoutSummaryFile).mockResolvedValue(mockFile);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1440,
    });

    render(
      <FinishWorkoutModal
        isOpen={true}
        exercises={mockExercises}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        workoutName="Desktop Push Day"
        workoutPhoto={makeWorkoutPhoto({
          url: "https://cdn.example.com/desktop-photo.png",
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /share/i }));

    const exportedNode = vi.mocked(imageHelpers.createWorkoutSummaryFile)
      .mock.calls[0][0] as HTMLElement;
    expect(
      exportedNode.querySelector(
        'img[alt="Workout photo for Desktop Push Day"]',
      ),
    ).not.toBeNull();
  });

  it("includes the uploaded photo in the share/export area on a mobile viewport", async () => {
    const user = userEvent.setup();
    const mockFile = new File([""], "test.png", { type: "image/png" });
    vi.mocked(imageHelpers.createWorkoutSummaryFile).mockResolvedValue(mockFile);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(
      <FinishWorkoutModal
        isOpen={true}
        exercises={mockExercises}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        workoutName="Mobile Push Day"
        workoutPhotoPreviewUrl="blob:mobile-preview"
        workoutPhoto={makeWorkoutPhoto({
          url: "https://cdn.example.com/mobile-photo.png",
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /share/i }));

    const exportedNode = vi.mocked(imageHelpers.createWorkoutSummaryFile)
      .mock.calls[0][0] as HTMLElement;
    const photo = exportedNode.querySelector(
      'img[alt="Workout photo for Mobile Push Day"]',
    ) as HTMLImageElement | null;
    expect(photo).not.toBeNull();
    expect(photo?.src).toContain("blob:mobile-preview");
  });
});
