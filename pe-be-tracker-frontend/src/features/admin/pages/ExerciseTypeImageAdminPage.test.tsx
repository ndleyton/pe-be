import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { render } from "@/test/testUtils";
import ExerciseTypeImageAdminPage from "./ExerciseTypeImageAdminPage";
import {
  applyExerciseImageOption,
  generateExerciseImageOptions,
  getExerciseImageOptions,
  type ExerciseImageOptionsResponse,
} from "@/features/admin/api/exerciseImageOptions";

vi.mock("@/features/admin/api/exerciseImageOptions", () => ({
  getExerciseImageOptions: vi.fn(),
  generateExerciseImageOptions: vi.fn(),
  applyExerciseImageOption: vi.fn(),
}));

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      initialized: true,
      user: { id: 1, is_superuser: true },
    }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useParams: () => ({ exerciseTypeId: "12" }),
  };
});

const mockGetExerciseImageOptions = vi.mocked(getExerciseImageOptions);
const mockGenerateExerciseImageOptions = vi.mocked(generateExerciseImageOptions);
const mockApplyExerciseImageOption = vi.mocked(applyExerciseImageOption);

const response: ExerciseImageOptionsResponse = {
  exercise_type_id: 12,
  exercise_name: "Lat Pulldown",
  current_images: ["https://example.com/live.png"],
  reference_images: ["https://example.com/reference.png"],
  supports_revert_to_reference: true,
  options: [
    {
      key: "clean-outline",
      label: "Clean Outline",
      description: "High-contrast line art with clearer limb and equipment definition.",
      option_source: "reference_redraw",
      images: ["https://example.com/clean.png"],
      candidate_ids: [1],
      source_images: ["https://example.com/reference.png"],
      is_current: false,
    },
    {
      key: "anatomy-focus",
      label: "Muscle Highlight",
      description:
        "Everkinetic-style muscle highlight on charcoal with simplified equipment.",
      option_source: "reference_redraw",
      images: ["https://example.com/highlight.png"],
      candidate_ids: [2],
      source_images: ["https://example.com/reference.png"],
      is_current: false,
    },
    {
      key: "minimal-outline",
      label: "Minimal Outline",
      description:
        "Centered charcoal composition with minimal outlines and preserved equipment.",
      option_source: "reference_redraw",
      images: ["https://example.com/minimal.png"],
      candidate_ids: [3],
      source_images: ["https://example.com/reference.png"],
      is_current: false,
    },
  ],
};

describe("ExerciseTypeImageAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExerciseImageOptions.mockResolvedValue(response);
    mockGenerateExerciseImageOptions.mockResolvedValue(response);
    mockApplyExerciseImageOption.mockResolvedValue(response);
  });

  it("lets the admin switch between reference styles and apply the selected one", async () => {
    render(<ExerciseTypeImageAdminPage />);

    await waitFor(() => {
      expect(mockGetExerciseImageOptions).toHaveBeenCalledWith("12");
    });

    const cleanOutlineButton = screen.getByRole("button", {
      name: /clean outline/i,
    });
    const minimalOutlineButton = screen.getByRole("button", {
      name: /minimal outline/i,
    });

    expect(
      screen.getByRole("button", { name: /muscle highlight/i }),
    ).toBeInTheDocument();
    expect(cleanOutlineButton).toHaveAttribute("aria-pressed", "true");
    expect(minimalOutlineButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("img", { name: "Generated images 1" })).toHaveAttribute(
      "src",
      "https://example.com/clean.png",
    );

    await userEvent.click(minimalOutlineButton);

    expect(cleanOutlineButton).toHaveAttribute("aria-pressed", "false");
    expect(minimalOutlineButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "Generated images 1" })).toHaveAttribute(
      "src",
      "https://example.com/minimal.png",
    );

    await userEvent.click(screen.getByRole("button", { name: /apply option/i }));

    await waitFor(() => {
      expect(mockApplyExerciseImageOption).toHaveBeenCalledWith("12", {
        option_key: "minimal-outline",
      });
    });
  });
});
