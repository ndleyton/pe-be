import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import {
  ACTIVE_CHAT_SESSION_KEY,
  persistActiveChatSession,
  readActiveChatSession,
} from "../lib/chatSession";
import ChatPage from "./ChatPage";

const { mockGet, mockPost, mockAuthState, mockNavigate } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockNavigate: vi.fn(),
  mockAuthState: {
    isAuthenticated: true,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/shared/api/client", () => ({
  default: {
    get: mockGet,
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
    mockNavigate.mockReset();
    mockGet.mockRejectedValue(new Error("Unauthorized"));
    sessionStorage.clear();
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

  it("renders a substitution widget when the assistant returns grounded exercise substitutions", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        message: "Here are a few grounded options.",
        conversation_id: 12,
        events: [
          {
            type: "exercise_substitutions_recommended",
            title: "Recommended substitutions",
            strategy: "same_primary_muscle_then_group_by_times_used",
            source_exercise: {
              id: 12,
              name: "Lat Pulldown",
            },
            substitutions: [
              {
                id: 21,
                name: "Chest-Supported Row",
                description: "Machine back exercise",
                equipment: "machine",
                category: "strength",
                match_reason: "same_primary_muscle",
                muscles: ["Latissimus Dorsi"],
              },
            ],
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
      "What can I do instead of lat pulldown?",
    );
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText("Here are a few grounded options."),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Alternatives to Lat Pulldown")).toBeInTheDocument();
    expect(screen.getByText("Chest-Supported Row")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /chest-supported row/i }),
    ).toHaveAttribute("href", "/exercise-types/21");
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

  it("starts a substitution handoff with a local assistant follow-up, then sends a grounded request after the user answers", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        message: "I found grounded substitutions for you.",
        conversation_id: 12,
        events: [
          {
            type: "exercise_substitutions_recommended",
            title: "Recommended substitutions",
            strategy: "same_primary_muscle_then_group_by_times_used",
            source_exercise: {
              id: 12,
              name: "Lat Pulldown",
            },
            substitutions: [
              {
                id: 21,
                name: "Chest-Supported Row",
                description: null,
                equipment: "machine",
                category: "strength",
                match_reason: "same_primary_muscle",
                muscles: [],
              },
            ],
          },
        ],
      },
    });

    const user = userEvent.setup();
    const { container } = renderChatPage([
      {
        pathname: "/chat",
        state: {
          chatIntent: {
            kind: "exercise_substitutions",
            exerciseTypeId: 12,
            exerciseTypeName: "Lat Pulldown",
          },
          autoStartChatIntent: true,
        },
      },
    ]);

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(
      {
        pathname: "/chat",
        search: "",
        hash: "",
      },
      {
        replace: true,
        state: {
          chatIntent: {
            kind: "exercise_substitutions",
            exerciseTypeId: 12,
            exerciseTypeName: "Lat Pulldown",
          },
          autoStartChatIntent: false,
        },
      },
    );

    expect(
      await screen.findByText(
        "I can help with alternatives to Lat Pulldown. What equipment do you have available, or what do you want to avoid?",
      ),
    ).toBeInTheDocument();

    const form = container.querySelector("form");
    if (!form) {
      throw new Error("Expected chat form to be rendered");
    }

    await user.type(screen.getByPlaceholderText("Message..."), "I only have cables.");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    expect(mockPost.mock.calls[0][0]).toBe("/chat");
    expect(mockPost.mock.calls[0][1]).toEqual({
      messages: [
        {
          role: "user",
          content: expect.stringContaining(
            '"exercise_type_id":12',
          ),
          parts: [
            {
              type: "text",
              text: expect.stringContaining('"exercise_type_id":12'),
            },
          ],
        },
      ],
      conversation_id: undefined,
    });
    expect(mockPost.mock.calls[0][1].messages[0].content).toContain(
      '"context_notes":"I only have cables."',
    );

    expect(
      await screen.findByText("Alternatives to Lat Pulldown"),
    ).toBeInTheDocument();
  });

  it("restores the saved UI thread from sessionStorage and skips seeded prompt autostart", async () => {
    persistActiveChatSession({
      conversationId: 12,
      messages: [
        {
          id: "assistant-restored",
          role: "assistant",
          content: "I created a routine for you.",
          parts: [
            {
              type: "text",
              text: "I created a routine for you.",
            },
          ],
          events: [
            {
              type: "routine_created",
              title: "Routine created",
              ctaLabel: "View routine",
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
          timestamp: new Date("2024-01-02T18:00:00.000Z"),
        },
      ],
    });
    expect(readActiveChatSession()?.messages).toHaveLength(1);

    mockGet.mockResolvedValueOnce({
      data: {
        id: 12,
        title: null,
        created_at: "2024-01-02T18:00:00Z",
        updated_at: "2024-01-02T18:05:00Z",
        is_active: true,
        messages: [],
      },
    });

    renderChatPage([
      {
        pathname: "/chat",
        state: {
          chatIntent: {
            kind: "exercise_substitutions",
            exerciseTypeId: 12,
            exerciseTypeName: "Lat Pulldown",
          },
          autoStartChatIntent: true,
        },
      },
    ]);

    await waitFor(() => {
      expect(screen.queryByText("Restoring chat")).not.toBeInTheDocument();
    });

    expect(
      await screen.findByText("I created a routine for you."),
    ).toBeInTheDocument();
    expect(screen.getByText("Beginner Full Body")).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith(
      {
        pathname: "/chat",
        search: "",
        hash: "",
      },
      {
        replace: true,
        state: {
          chatIntent: {
            kind: "exercise_substitutions",
            exerciseTypeId: 12,
            exerciseTypeName: "Lat Pulldown",
          },
          autoStartChatIntent: false,
        },
      },
    );
    expect(
      screen.queryByText(
        "I can help with alternatives to Lat Pulldown. What equipment do you have available, or what do you want to avoid?",
      ),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/chat/conversations/12");
    });
  });

  it("restores the conversation from the backend when only the saved conversation id is available", async () => {
    sessionStorage.setItem(
      ACTIVE_CHAT_SESSION_KEY,
      JSON.stringify({
        conversationId: 12,
        messages: [],
      }),
    );

    mockGet.mockResolvedValueOnce({
      data: {
        id: 12,
        title: null,
        created_at: "2024-01-02T18:00:00Z",
        updated_at: "2024-01-02T18:05:00Z",
        is_active: true,
        messages: [
          {
            id: 201,
            role: "user",
            content: "Check this form",
            created_at: "2024-01-02T18:00:00Z",
            parts: [
              {
                id: 1,
                type: "image",
                attachment_id: 99,
                mime_type: "image/png",
                filename: "form-check.png",
              },
              {
                id: 2,
                type: "text",
                text: "Check this form",
              },
            ],
          },
          {
            id: 202,
            role: "assistant",
            content: "Looks solid.",
            created_at: "2024-01-02T18:01:00Z",
            parts: [
              {
                id: 3,
                type: "text",
                text: "Looks solid.",
              },
            ],
          },
        ],
      },
    });

    renderChatPage();

    expect(await screen.findByText("Looks solid.")).toBeInTheDocument();
    expect(screen.getByText("Check this form")).toBeInTheDocument();
    expect(screen.getByAltText("form-check.png")).toHaveAttribute(
      "src",
      expect.stringContaining("/chat/attachments/99"),
    );
  });

  it("clears the saved session when the stored conversation no longer exists", async () => {
    sessionStorage.setItem(
      ACTIVE_CHAT_SESSION_KEY,
      JSON.stringify({
        conversationId: 12,
        messages: [],
      }),
    );

    mockGet.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });

    renderChatPage();

    expect(
      await screen.findByText("Meet Personal Bestie"),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(ACTIVE_CHAT_SESSION_KEY)).toBeNull();
  });

  it("starts a brand-new chat when the reset button is pressed", async () => {
    persistActiveChatSession({
      conversationId: 12,
      messages: [
        {
          id: "assistant-restored",
          role: "assistant",
          content: "Welcome back.",
          parts: [
            {
              type: "text",
              text: "Welcome back.",
            },
          ],
          timestamp: new Date("2024-01-02T18:00:00.000Z"),
        },
      ],
    });
    expect(readActiveChatSession()?.messages).toHaveLength(1);

    mockGet.mockResolvedValueOnce({
      data: {
        id: 12,
        title: null,
        created_at: "2024-01-02T18:00:00Z",
        updated_at: "2024-01-02T18:05:00Z",
        is_active: true,
        messages: [],
      },
    });

    const user = userEvent.setup();
    renderChatPage();

    await waitFor(() => {
      expect(screen.queryByText("Restoring chat")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Welcome back.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(screen.queryByText("Welcome back.")).not.toBeInTheDocument();
    expect(screen.getByText("Meet Personal Bestie")).toBeInTheDocument();
    expect(sessionStorage.getItem(ACTIVE_CHAT_SESSION_KEY)).toBeNull();
  });
});
