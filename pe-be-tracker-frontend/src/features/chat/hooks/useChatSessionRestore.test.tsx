import { renderHook, waitFor } from "@/test/testUtils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_CHAT_SESSION_KEY,
  persistActiveChatSession,
} from "../lib/chatSession";
import { useChatSessionRestore } from "./useChatSessionRestore";

const mockGetConversation = vi.fn();

vi.mock("../api/chatApi", () => ({
  getConversation: (...args: unknown[]) => mockGetConversation(...args),
}));

describe("useChatSessionRestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("hydrates the saved UI thread from session storage", async () => {
    persistActiveChatSession({
      conversationId: 12,
      messages: [
        {
          id: "assistant-restored",
          role: "assistant",
          content: "Welcome back.",
          parts: [{ type: "text", text: "Welcome back." }],
          timestamp: new Date("2024-01-02T18:00:00.000Z"),
        },
      ],
    });

    mockGetConversation.mockResolvedValueOnce({
      id: 12,
      title: null,
      created_at: "2024-01-02T18:00:00Z",
      updated_at: "2024-01-02T18:05:00Z",
      is_active: true,
      messages: [],
    });

    const { result } = renderHook(() =>
      useChatSessionRestore({ isAuthenticated: true }),
    );

    await waitFor(() => {
      expect(result.current.restorationResolved).toBe(true);
    });

    expect(result.current.conversationId).toBe(12);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("Welcome back.");

    await waitFor(() => {
      expect(mockGetConversation).toHaveBeenCalledWith(12);
    });
  });

  it("restores the conversation from the backend when only the conversation id was saved", async () => {
    sessionStorage.setItem(
      ACTIVE_CHAT_SESSION_KEY,
      JSON.stringify({
        conversationId: 12,
        messages: [],
      }),
    );

    mockGetConversation.mockResolvedValueOnce({
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
    });

    const { result } = renderHook(() =>
      useChatSessionRestore({ isAuthenticated: true }),
    );

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.conversationId).toBe(12);
    expect(result.current.messages[0].content).toBe("Check this form");
    expect(result.current.messages[1].content).toBe("Looks solid.");
    expect(result.current.messages[0].parts?.[0]).toEqual(
      expect.objectContaining({
        type: "image",
        attachment_id: 99,
        filename: "form-check.png",
        url: expect.stringContaining("/chat/attachments/99"),
      }),
    );
  });

  it("clears the saved session when the stored conversation returns 404", async () => {
    sessionStorage.setItem(
      ACTIVE_CHAT_SESSION_KEY,
      JSON.stringify({
        conversationId: 12,
        messages: [],
      }),
    );

    mockGetConversation.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });

    const { result } = renderHook(() =>
      useChatSessionRestore({ isAuthenticated: true }),
    );

    await waitFor(() => {
      expect(result.current.restorationResolved).toBe(true);
    });

    expect(result.current.conversationId).toBeUndefined();
    expect(result.current.messages).toHaveLength(0);
    expect(sessionStorage.getItem(ACTIVE_CHAT_SESSION_KEY)).toBeNull();
  });

  it("clears the restored session when the user signs out", async () => {
    persistActiveChatSession({
      conversationId: 12,
      messages: [
        {
          id: "assistant-restored",
          role: "assistant",
          content: "Welcome back.",
          parts: [{ type: "text", text: "Welcome back." }],
          timestamp: new Date("2024-01-02T18:00:00.000Z"),
        },
      ],
    });

    mockGetConversation.mockResolvedValueOnce({
      id: 12,
      title: null,
      created_at: "2024-01-02T18:00:00Z",
      updated_at: "2024-01-02T18:05:00Z",
      is_active: true,
      messages: [],
    });

    const { result, rerender } = renderHook(
      ({ isAuthenticated }) => useChatSessionRestore({ isAuthenticated }),
      {
        initialProps: { isAuthenticated: true },
      },
    );

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    rerender({ isAuthenticated: false });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(0);
    });

    expect(result.current.conversationId).toBeUndefined();
    expect(sessionStorage.getItem(ACTIVE_CHAT_SESSION_KEY)).toBeNull();
  });
});
