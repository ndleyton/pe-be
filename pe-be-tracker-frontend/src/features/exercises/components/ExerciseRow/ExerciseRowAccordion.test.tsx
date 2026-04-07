import { describe, it, expect, vi } from "vitest";

// Mock the Carousel components since they might be complex
vi.mock("@/shared/components/ui/carousel", () => ({
  Carousel: ({ children }: any) => <div data-testid="carousel">{children}</div>,
  CarouselContent: ({ children }: any) => <div data-testid="carousel-content">{children}</div>,
  CarouselItem: ({ children }: any) => <div data-testid="carousel-item">{children}</div>,
  CarouselPrevious: () => <button data-testid="carousel-prev">Prev</button>,
  CarouselNext: () => <button data-testid="carousel-next">Next</button>,
}));

// Mock the Accordion components to avoid Radix UI state issues in tests
vi.mock("@/shared/components/ui/accordion", () => ({
  Accordion: ({ children }: any) => <div data-testid="accordion">{children}</div>,
  AccordionItem: ({ children }: any) => <div data-testid="accordion-item">{children}</div>,
  AccordionContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
  AccordionTrigger: ({ children }: any) => <div data-testid="accordion-trigger">{children}</div>,
}));

import { screen, fireEvent } from "@testing-library/react";
import { render } from "@/test/testUtils";
import ExerciseRow from "./ExerciseRow";
import { Exercise } from "@/features/exercises/api";

const mockExercise: Exercise = {
  id: 123,
  timestamp: "2024-01-01T10:00:00Z",
  notes: "Great workout!",
  exercise_type_id: 1,
  workout_id: 456,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  exercise_type: {
    id: 1,
    name: "Bench Press",
    description: "Chest exercise",
    default_intensity_unit: 1,
    times_used: 5,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    muscle_groups: ["chest"],
    equipment: "barbell",
    instructions: null,
    category: null,
    usage_count: 5,
    images: ["image1.jpg", "image2.jpg"],
    status: "released",
  },
  exercise_sets: [],
};

describe("ExerciseRow Accordion", () => {
  it("renders expansion trigger when images are present", () => {
    render(<ExerciseRow exercise={mockExercise} />);
    
    expect(screen.getByRole("button", { name: /show exercise images/i })).toBeInTheDocument();
  });

  it("does not render expansion trigger when no images are present", () => {
    const noImagesExercise = {
      ...mockExercise,
      exercise_type: {
        ...mockExercise.exercise_type,
        images: [],
      },
    };
    render(<ExerciseRow exercise={noImagesExercise} />);
    
    expect(screen.queryByRole("button", { name: /show exercise images/i })).not.toBeInTheDocument();
  });

  it("toggles expansion when trigger is clicked", async () => {
    const onToggleExpand = vi.fn();
    render(
      <ExerciseRow 
        exercise={mockExercise} 
        isExpanded={false} 
        onToggleExpand={onToggleExpand} 
      />
    );
    
    const trigger = screen.getByRole("button", { name: /show exercise images/i });
    fireEvent.click(trigger);

    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("updates the accessible label when expanded", () => {
    render(
      <ExerciseRow
        exercise={mockExercise}
        isExpanded={true}
      />
    );

    expect(
      screen.getByRole("button", { name: /hide exercise images/i }),
    ).toBeInTheDocument();
  });

  it("shows image panel when expanded", () => {
    render(
      <ExerciseRow 
        exercise={mockExercise} 
        isExpanded={true} 
      />
    );
    
    expect(screen.getByTestId("carousel")).toBeInTheDocument();
    // Verify images are rendered
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "image1.jpg");
  });

  it("hides expansion trigger for guest exercise types", () => {
    const guestExercise = {
      ...mockExercise,
      exercise_type: {
        ...mockExercise.exercise_type,
        id: "guest-1" as any,
        images: [],
      },
    };
    render(<ExerciseRow exercise={guestExercise} />);
    
    expect(screen.queryByRole("button", { name: /show exercise images/i })).not.toBeInTheDocument();
  });
});
