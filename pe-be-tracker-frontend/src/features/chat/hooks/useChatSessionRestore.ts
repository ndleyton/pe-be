import { useCallback, useEffect, useRef, useState } from "react";

import { getConversation } from "../api/chatApi";
import { mapConversationToChatMessages } from "../lib/chatConversation";
import {
  clearActiveChatSession,
  persistActiveChatSession,
  readActiveChatSession,
} from "../lib/chatSession";
import { type ChatMessage } from "../types";

interface UseChatSessionRestoreOptions {
  isAuthenticated: boolean;
}

const extractResponseStatus = (error: unknown): number | null => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    typeof error.response.status === "number"
  ) {
    return error.response.status;
  }

  return null;
};

export const useChatSessionRestore = ({
  isAuthenticated,
}: UseChatSessionRestoreOptions) => {
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [restorationResolved, setRestorationResolved] = useState(!isAuthenticated);
  const activeConversationIdRef = useRef<number | undefined>(undefined);
  const restoreAttemptedRef = useRef(false);

  const resetConversationState = useCallback(() => {
    activeConversationIdRef.current = undefined;
    clearActiveChatSession();
    setMessages([]);
    setConversationId(undefined);
    setRestorationResolved(true);
  }, []);

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!isAuthenticated) {
      restoreAttemptedRef.current = false;
      resetConversationState();
      return;
    }

    if (restoreAttemptedRef.current) {
      return;
    }

    restoreAttemptedRef.current = true;
    setRestorationResolved(false);

    const storedSession = readActiveChatSession();

    if (!storedSession?.conversationId) {
      setRestorationResolved(true);
      return;
    }

    let cancelled = false;

    const clearRestoredConversation = () => {
      if (cancelled) {
        return;
      }

      resetConversationState();
    };

    const restoreConversation = async () => {
      try {
        const conversation = await getConversation(storedSession.conversationId);

        if (cancelled || storedSession.messages.length > 0) {
          return;
        }

        activeConversationIdRef.current = conversation.id;
        setMessages(mapConversationToChatMessages(conversation));
        setConversationId(conversation.id);
      } catch (error) {
        if (
          extractResponseStatus(error) === 404 &&
          (
            activeConversationIdRef.current === undefined ||
            activeConversationIdRef.current === storedSession.conversationId
          )
        ) {
          clearRestoredConversation();
        }
      } finally {
        if (!cancelled) {
          setRestorationResolved(true);
        }
      }
    };

    if (storedSession.messages.length > 0) {
      activeConversationIdRef.current = storedSession.conversationId;
      setMessages(storedSession.messages);
      setConversationId(storedSession.conversationId);
      setRestorationResolved(true);
      void restoreConversation();

      return () => {
        cancelled = true;
      };
    }

    void restoreConversation();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, resetConversationState]);

  useEffect(() => {
    if (!restorationResolved) {
      return;
    }

    if (!isAuthenticated) {
      clearActiveChatSession();
      return;
    }

    if (!conversationId || messages.length === 0) {
      clearActiveChatSession();
      return;
    }

    persistActiveChatSession({
      conversationId,
      messages,
    });
  }, [conversationId, isAuthenticated, messages, restorationResolved]);

  return {
    conversationId,
    messages,
    restorationResolved,
    resetConversationState,
    setConversationId,
    setMessages,
  };
};
