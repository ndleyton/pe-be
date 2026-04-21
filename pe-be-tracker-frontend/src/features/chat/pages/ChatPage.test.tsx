import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import ChatPage from "./ChatPage";

const { mockPost, mockAuthState } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockAuthState: {
    isAuthenticated: true,
  },
}));

vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error("Unauthorized")),
    post: mockPost,
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn((selector) => {
    return selector ? selector(mockAuthState) : mockAuthState;
  }),
}));

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  const renderChatPage = (
    initialEntries: Array<string | { pathname: string; state?: unknown }> = ["/chat"],
  ) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <ChatPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it("renders a workout widget when the assistant returns a workout-created event", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        message: "I created a workout for you.",
        conversation_id: 12,
        events: [
          {
            type: "workout_created",
            title: "Workout created",
            cta_label: "View workout",
            workout: {
              id: 42,
              name: "Leg Day",
              notes: "Focus on depth and tempo.",
              start_time: "2024-01-02T18:00:00Z",
              end_time: "2024-01-02T19:00:00Z",
            },
          },
        ],
      },
    });

    const user = userEvent.setup();
    const { container } = renderChatPage();
    const form = container.querySelector("form");

    if (!form) {
      throw new Error("Expected chat form to be rendered");
    }
    await user.type(
      screen.getByPlaceholderText("Message..."),
      "Build me a leg workout",
    );
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("I created a workout for you.")).toBeInTheDocument();
    });

    expect(screen.getByText("Leg Day")).toBeInTheDocument();
    expect(screen.getByText("Focus on depth and tempo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View workout" })).toHaveAttribute(
      "href",
      "/workouts/42",
    );
  });

  it("renders a routine widget when the assistant returns a routine-created event", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        message: "I created a routine for you.",
        conversation_id: 12,
        events: [
          {
            type: "routine_created",
            title: "Routine created",
            cta_label: "View routine",
            routine: {
              id: 77,
              name: "Beginner Full Body",
              description: "Built for three gym days per week.",
              workout_type_id: 4,
              exercise_count: 6,
              set_count: 18,
            },
          },
        ],
      },
    });

    const user = userEvent.setup();
    const { container } = renderChatPage();
    const form = container.querySelector("form");

    if (!form) {
      throw new Error("Expected chat form to be rendered");
    }
    await user.type(
      screen.getByPlaceholderText("Message..."),
      "Make me a beginner full body routine",
    );
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("I created a routine for you.")).toBeInTheDocument();
    });

    expect(screen.getByText("Beginner Full Body")).toBeInTheDocument();
    expect(
      screen.getByText("Built for three gym days per week."),
    ).toBeInTheDocument();
    expect(screen.getByText("6 exercises")).toBeInTheDocument();
    expect(screen.getByText("18 sets")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View routine" })).toHaveAttribute(
      "href",
      "/routines/77",
    );
  });

  it("surfaces backend chat error details instead of a generic fallback", async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        data: {
          detail: "Error generating response with Gemini: tool call failed.",
        },
      },
    });

    const user = userEvent.setup();
    const { container } = renderChatPage();
    const form = container.querySelector("form");

    if (!form) {
      throw new Error("Expected chat form to be rendered");
    }

    await user.type(
      screen.getByPlaceholderText("Message..."),
      "Build me a leg workout",
    );
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Error generating response with the AI coach: tool call failed.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows logged-in-only copy when the user is signed out", async () => {
    mockAuthState.isAuthenticated = false;

    const user = userEvent.setup();
    const { container } = renderChatPage();
    const form = container.querySelector("form");

    if (!form) {
      throw new Error("Expected chat form to be rendered");
    }

    expect(
      screen.getByText(
        "Ask questions, log workouts, get coaching, or create a personalized routine just for you.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sign in to use chat and image uploads/,
      ),
    ).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Message..."), "Hello");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Chat is available for logged-in users. Please sign in to continue.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("seeds the input from route state when arriving from another screen", async () => {
    renderChatPage([
      {
        pathname: "/chat",
        state: {
          seedPrompt:
            "Suggest 2-3 alternatives to Bench Press. Keep the same primary muscle if possible.",
        },
      },
    ]);

    expect(
      await screen.findByDisplayValue(
        "Suggest 2-3 alternatives to Bench Press. Keep the same primary muscle if possible.",
      ),
    ).toBeInTheDocument();
  });
});
