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
  available_options: [
    {
      key: "clean-outline",
      label: "Clean Outline",
      description: "High-contrast line art with clearer limb and equipment definition.",
      option_source: "reference_redraw",
    },
    {
      key: "anatomy-focus",
      label: "Muscle Highlight",
      description:
        "Everkinetic-style muscle highlight on charcoal with simplified equipment.",
      option_source: "reference_redraw",
    },
    {
      key: "minimal-outline",
      label: "Minimal Outline",
      description:
        "Centered charcoal composition with minimal outlines and preserved equipment.",
      option_source: "reference_redraw",
    },
  ],
  options: [],
};

describe("ExerciseTypeImageAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExerciseImageOptions.mockResolvedValue(response);
    mockGenerateExerciseImageOptions.mockResolvedValue(response);
    mockApplyExerciseImageOption.mockResolvedValue(response);
  });

  it("generates the selected reference option spec", async () => {
    render(<ExerciseTypeImageAdminPage />);

    await waitFor(() => {
      expect(mockGetExerciseImageOptions).toHaveBeenCalledWith("12");
    });

    expect(screen.getByText(/generation style/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate clean outline/i }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /minimal outline/i }),
    );

    expect(
      screen.getByRole("button", { name: /generate minimal outline/i }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /generate minimal outline/i }),
    );

    await waitFor(() => {
      expect(mockGenerateExerciseImageOptions).toHaveBeenCalledWith("12", {
        option_key: "minimal-outline",
      });
    });
  });
});
