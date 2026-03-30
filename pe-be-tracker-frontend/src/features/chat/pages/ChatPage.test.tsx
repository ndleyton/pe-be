import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";

import ChatPage from "./ChatPage";

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    isAuthenticated: true,
  },
}));

vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn((selector) => {
    return selector ? selector(mockAuthState) : mockAuthState;
  }),
}));

const mockApi = {
  get: vi.mocked(api.get),
  post: vi.mocked(api.post),
  put: vi.mocked(api.put),
  delete: vi.mocked(api.delete),
};

const createTestQueryClient = () =>
  new QueryClient({
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

const renderChatPage = () =>
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockApi.get.mockResolvedValue({
      data: {
        conversations: [],
        total: 0,
        limit: 20,
        offset: 0,
      },
    } as never);
  });

  it("loads the most recent saved conversation and renders image parts", async () => {
    mockApi.get.mockImplementation((url) => {
      if (url === endpoints.conversations) {
        return Promise.resolve({
          data: {
            conversations: [
              {
                id: 7,
                title: "Shoulders chat",
                created_at: "2026-03-30T12:00:00Z",
                updated_at: "2026-03-30T12:10:00Z",
                is_active: true,
              },
            ],
            total: 1,
            limit: 20,
            offset: 0,
          },
        } as never);
      }

      if (url === endpoints.conversationById(7)) {
        return Promise.resolve({
          data: {
            id: 7,
            title: "Shoulders chat",
            created_at: "2026-03-30T12:00:00Z",
            updated_at: "2026-03-30T12:10:00Z",
            is_active: true,
            messages: [
              {
                id: 10,
                role: "user",
                content: "Can you check my form photo?",
                created_at: "2026-03-30T12:01:00Z",
                parts: [
                  {
                    type: "image",
                    attachment_id: 44,
                    mime_type: "image/png",
                    filename: "pose-check.png",
                  },
                  {
                    type: "text",
                    text: "Can you check my form photo?",
                  },
                ],
              },
              {
                id: 11,
                role: "assistant",
                content: "Use lighter accessory volume.",
                created_at: "2026-03-30T12:02:00Z",
                parts: [
                  {
                    type: "text",
                    text: "Use lighter accessory volume.",
                  },
                ],
              },
            ],
          },
        } as never);
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    renderChatPage();

    expect(await screen.findByText("Shoulders chat")).toBeInTheDocument();
    expect(
      await screen.findByText("Use lighter accessory volume."),
    ).toBeInTheDocument();

    const attachment = screen.getByAltText("pose-check.png");
    expect(attachment).toHaveAttribute(
      "src",
      expect.stringContaining("/chat/attachments/44"),
    );
  });

  it("switches to another saved conversation from history", async () => {
    const user = userEvent.setup();

    mockApi.get.mockImplementation((url) => {
      if (url === endpoints.conversations) {
        return Promise.resolve({
          data: {
            conversations: [
              {
                id: 7,
                title: "Shoulders chat",
                created_at: "2026-03-30T12:00:00Z",
                updated_at: "2026-03-30T12:10:00Z",
                is_active: true,
              },
              {
                id: 8,
                title: "Leg day recap",
                created_at: "2026-03-29T10:00:00Z",
                updated_at: "2026-03-29T10:10:00Z",
                is_active: true,
              },
            ],
            total: 2,
            limit: 20,
            offset: 0,
          },
        } as never);
      }

      if (url === endpoints.conversationById(7)) {
        return Promise.resolve({
          data: {
            id: 7,
            title: "Shoulders chat",
            created_at: "2026-03-30T12:00:00Z",
            updated_at: "2026-03-30T12:10:00Z",
            is_active: true,
            messages: [
              {
                id: 10,
                role: "assistant",
                content: "First conversation reply",
                created_at: "2026-03-30T12:02:00Z",
                parts: [{ type: "text", text: "First conversation reply" }],
              },
            ],
          },
        } as never);
      }

      if (url === endpoints.conversationById(8)) {
        return Promise.resolve({
          data: {
            id: 8,
            title: "Leg day recap",
            created_at: "2026-03-29T10:00:00Z",
            updated_at: "2026-03-29T10:10:00Z",
            is_active: true,
            messages: [
              {
                id: 12,
                role: "assistant",
                content: "Second conversation reply",
                created_at: "2026-03-29T10:02:00Z",
                parts: [{ type: "text", text: "Second conversation reply" }],
              },
            ],
          },
        } as never);
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    renderChatPage();

    expect(await screen.findByText("First conversation reply")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /leg day recap/i }));

    expect(await screen.findByText("Second conversation reply")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("First conversation reply")).not.toBeInTheDocument();
    });
  });

  it("renders a workout widget when the assistant returns a workout-created event", async () => {
    mockApi.post.mockResolvedValueOnce({
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
    mockApi.post.mockRejectedValueOnce({
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
        "Ask questions, log workouts, or attach photos for coaching and analysis.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sign in to use chat and image uploads. This feature is for logged-in users.",
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
});
