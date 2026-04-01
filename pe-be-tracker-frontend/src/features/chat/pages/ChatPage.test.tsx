import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import ChatPage from "./ChatPage";

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
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
    const mockState = {
      isAuthenticated: true,
    };

    return selector ? selector(mockState) : mockState;
  }),
}));

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  const renderChatPage = () => {
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
        <MemoryRouter>
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
          "Error generating response with Gemini: tool call failed.",
        ),
      ).toBeInTheDocument();
    });
  });
});
