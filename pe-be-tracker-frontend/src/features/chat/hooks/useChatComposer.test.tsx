import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ChangeEvent, type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ChatMessage,
  type ExerciseSubstitutionChatIntent,
} from "../types";
import { useChatComposer } from "./useChatComposer";

const mockSendChatMessage = vi.fn();
const mockUploadChatAttachment = vi.fn();

vi.mock("../api/chatApi", () => ({
  sendChatMessage: (...args: unknown[]) => mockSendChatMessage(...args),
  uploadChatAttachment: (...args: unknown[]) => mockUploadChatAttachment(...args),
}));

interface ComposerHarnessOptions {
  clearPendingSubstitutionIntent?: () => void;
  isAuthenticated?: boolean;
  pendingSubstitutionIntent?: ExerciseSubstitutionChatIntent | null;
}

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

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderComposer = ({
  clearPendingSubstitutionIntent = vi.fn(),
  isAuthenticated = true,
  pendingSubstitutionIntent = null,
}: ComposerHarnessOptions = {}) =>
  renderHook(() => {
    const [conversationId, setConversationId] = useState<number | undefined>();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const composer = useChatComposer({
      clearPendingSubstitutionIntent,
      conversationId,
      isAuthenticated,
      pendingSubstitutionIntent,
      setConversationId,
      setMessages,
    });

    return {
      conversationId,
      messages,
      ...composer,
    };
  }, { wrapper });

describe("useChatComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("sends a text-only authenticated message and appends the response", async () => {
    mockSendChatMessage.mockResolvedValueOnce({
      message: "Here is a plan.",
      conversation_id: 12,
    });

    const { result } = renderComposer();

    act(() => {
      result.current.handleInputChange("Build me a leg workout");
    });

    await act(async () => {
      await result.current.handleSubmitMessage();
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(mockSendChatMessage).toHaveBeenCalledWith(
      [
        {
          role: "user",
          content: "Build me a leg workout",
          parts: [
            {
              type: "text",
              text: "Build me a leg workout",
            },
          ],
        },
      ],
      undefined,
    );
    expect(result.current.conversationId).toBe(12);
    expect(result.current.messages[0]).toEqual(
      expect.objectContaining({
        role: "user",
        content: "Build me a leg workout",
      }),
    );
    expect(result.current.messages[1]).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Here is a plan.",
      }),
    );
    expect(result.current.inputValue).toBe("");
  });

  it("validates unsupported attachment types before upload", () => {
    const { result } = renderComposer();
    const file = new File(["gif"], "unsupported.gif", { type: "image/gif" });
    const event = {
      target: {
        files: [file],
        value: "unsupported.gif",
      },
    } as unknown as ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleFileChange(event);
    });

    expect(result.current.attachmentError).toBe(
      "unsupported.gif is not supported. Use PNG, JPEG, or WebP.",
    );
    expect(result.current.pendingAttachments).toHaveLength(0);
  });

  it("surfaces upload failures without sending the chat request", async () => {
    mockUploadChatAttachment.mockRejectedValueOnce(new Error("Upload failed"));

    const { result } = renderComposer();
    const file = new File(["png"], "form.png", { type: "image/png" });
    const event = {
      target: {
        files: [file],
        value: "form.png",
      },
    } as unknown as ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleFileChange(event);
    });

    await act(async () => {
      await result.current.handleSubmitMessage("Check this form");
    });

    await waitFor(() => {
      expect(result.current.attachmentError).toBe(
        "I couldn't upload one of the images. Check the file type/size and try again.",
      );
    });

    expect(mockSendChatMessage).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("falls back to a local signed-out response without calling the API", async () => {
    vi.useFakeTimers();

    const { result } = renderComposer({ isAuthenticated: false });

    act(() => {
      result.current.handleInputChange("Hello");
    });

    await act(async () => {
      await result.current.handleSubmitMessage();
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(
      expect.objectContaining({
        role: "user",
        content: "Hello",
      }),
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toEqual(
      expect.objectContaining({
        role: "assistant",
        content:
          "Chat is available for logged-in users. Please sign in to continue.",
      }),
    );
    expect(mockSendChatMessage).not.toHaveBeenCalled();
  });

  it("clears pending attachments after a signed-out send", async () => {
    vi.useFakeTimers();

    const { result } = renderComposer({ isAuthenticated: false });
    const file = new File(["png"], "form.png", { type: "image/png" });
    const event = {
      target: {
        files: [file],
        value: "form.png",
      },
    } as unknown as ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleFileChange(event);
    });

    expect(result.current.pendingAttachments).toHaveLength(1);
    expect(result.current.canSubmitMessage).toBe(true);

    await act(async () => {
      await result.current.handleSubmitMessage();
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(
      expect.objectContaining({
        role: "user",
        content: "",
        parts: [],
      }),
    );
    expect(result.current.pendingAttachments).toHaveLength(0);
    expect(result.current.canSubmitMessage).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    expect(mockSendChatMessage).not.toHaveBeenCalled();
  });
});
