import { renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ChatMessage, type ChatPageLocationState } from "../types";
import { useChatSubstitutionIntent } from "./useChatSubstitutionIntent";

const baseIntent = {
  kind: "exercise_substitutions" as const,
  exerciseTypeId: 12,
  exerciseTypeName: "Lat Pulldown",
};

interface HarnessProps {
  autoStartChatIntent: boolean;
  initialMessages?: ChatMessage[];
  restorationResolved: boolean;
  routeState: ChatPageLocationState | null;
}

const renderSubstitutionIntentHook = ({
  autoStartChatIntent,
  initialMessages = [],
  restorationResolved,
  routeState,
}: HarnessProps) => {
  const navigate = vi.fn();

  const hook = renderHook(() => {
    const [messages, setMessages] = useState(initialMessages);
    const substitutionIntent = useChatSubstitutionIntent({
      autoStartChatIntent,
      chatIntent: routeState?.chatIntent,
      location: {
        pathname: "/chat",
        search: "",
        hash: "",
      },
      messages,
      navigate,
      restorationResolved,
      routeState,
      setMessages,
    });

    return {
      messages,
      navigate,
      ...substitutionIntent,
    };
  });

  return {
    navigate,
    ...hook,
  };
};

describe("useChatSubstitutionIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not auto-seed when a restored conversation already has messages and still consumes the route flag", async () => {
    const { result, navigate } = renderSubstitutionIntentHook({
      autoStartChatIntent: true,
      initialMessages: [
        {
          id: "restored",
          role: "assistant",
          content: "Welcome back.",
          parts: [{ type: "text", text: "Welcome back." }],
          timestamp: new Date("2024-01-02T18:00:00.000Z"),
        },
      ],
      restorationResolved: true,
      routeState: {
        chatIntent: baseIntent,
        autoStartChatIntent: true,
      },
    });

    expect(result.current.pendingSubstitutionIntent).toBeNull();
    expect(result.current.messages).toHaveLength(1);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        {
          pathname: "/chat",
          search: "",
          hash: "",
        },
        {
          replace: true,
          state: {
            chatIntent: baseIntent,
            autoStartChatIntent: false,
          },
        },
      );
    });
  });

  it("seeds the follow-up prompt and clears the route auto-start flag", async () => {
    const { result, navigate } = renderSubstitutionIntentHook({
      autoStartChatIntent: true,
      restorationResolved: true,
      routeState: {
        chatIntent: baseIntent,
        autoStartChatIntent: true,
      },
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    expect(result.current.pendingSubstitutionIntent).toEqual(baseIntent);
    expect(result.current.messages[0].content).toBe(
      "I can help with alternatives to Lat Pulldown. What equipment do you have available, or what do you want to avoid?",
    );
    expect(navigate).toHaveBeenCalledWith(
      {
        pathname: "/chat",
        search: "",
        hash: "",
      },
      {
        replace: true,
        state: {
          chatIntent: baseIntent,
          autoStartChatIntent: false,
        },
      },
    );
  });
});
