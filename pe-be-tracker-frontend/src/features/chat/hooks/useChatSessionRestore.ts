import { useCallback, useEffect, useRef, useState } from "react";

import { getConversation } from "../api/chatApi";
import { reconcileConversationMessages } from "../lib/chatConversation";
import {
  clearActiveChatSession,
  persistActiveChatSession,
  readActiveChatSession,
} from "../lib/chatSession";
import { type ChatMessage } from "../types";

interface UseChatSessionRestoreOptions {
  isAuthenticated: boolean;
  userId?: number;
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
  userId,
}: UseChatSessionRestoreOptions) => {
  const [sessionOwner, setSessionOwner] = useState(userId);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [restorationResolved, setRestorationResolved] = useState(!isAuthenticated);
  const activeConversationIdRef = useRef<number | undefined>(undefined);
  const requestRef = useRef(0);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const resetConversationState = useCallback(() => {
    requestRef.current += 1;
    setRestoreError(null);
    activeConversationIdRef.current = undefined;
    clearActiveChatSession(userId);
    setMessages([]);
    setConversationId(undefined);
    setRestorationResolved(true);
  }, [userId]);

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    requestRef.current += 1;
    setSessionOwner(userId);
    setMessages([]);
    setConversationId(undefined);
    setRestoreError(null);
    if (!isAuthenticated) {
      resetConversationState();
      return;
    }

    setRestorationResolved(false);

    const scopedSession = readActiveChatSession(userId);
    // Legacy caches have no owner. Only adopt them after the server authorizes the ID.
    const legacySession = userId !== undefined && !scopedSession ? readActiveChatSession() : null;
    const storedSession = scopedSession ?? legacySession;

    if (!storedSession?.conversationId) {
      setRestorationResolved(true);
      return;
    }

    let cancelled = false;
    const request = ++requestRef.current;

    const clearRestoredConversation = () => {
      if (cancelled || request !== requestRef.current) {
        return;
      }

      resetConversationState();
    };

    const restoreConversation = async () => {
      try {
        const conversation = await getConversation(storedSession.conversationId);

        if (cancelled || request !== requestRef.current) {
          return;
        }

        activeConversationIdRef.current = conversation.id;
        // Keep local widgets when the server transcript has not advanced.
        if ((conversation.messages?.length ?? 0) > storedSession.messages.length || storedSession.messages.length === 0) {
          setMessages(reconcileConversationMessages(conversation, storedSession.messages));
        } else if (legacySession) {
          setMessages(storedSession.messages);
        }
        if (legacySession) clearActiveChatSession();
        setConversationId(conversation.id);
      } catch (error) {
        if (cancelled || request !== requestRef.current) return;
        if (
          extractResponseStatus(error) === 404 &&
          (
            activeConversationIdRef.current === undefined ||
            activeConversationIdRef.current === storedSession.conversationId
          )
        ) {
          clearRestoredConversation();
        } else {
          setRestoreError("Could not refresh this chat. Try opening it from chat history.");
        }
      } finally {
        if (!cancelled && request === requestRef.current) {
          setRestorationResolved(true);
        }
      }
    };

    if (!legacySession && storedSession.messages.length > 0) {
      activeConversationIdRef.current = storedSession.conversationId;
      setMessages(storedSession.messages);
      setConversationId(storedSession.conversationId);
      void restoreConversation();

      return () => {
        cancelled = true;
      };
    }

    void restoreConversation();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, resetConversationState, userId]);

  useEffect(() => {
    if (sessionOwner !== userId || !restorationResolved) {
      return;
    }

    if (!isAuthenticated) {
      clearActiveChatSession(userId);
      return;
    }

    if (!conversationId) {
      return;
    }

    persistActiveChatSession({
      conversationId,
      messages,
    }, userId);
  }, [conversationId, isAuthenticated, messages, restorationResolved, sessionOwner, userId]);

  useEffect(() => () => { requestRef.current += 1; }, []);

  const openConversation = useCallback(async (id: number) => {
    const request = ++requestRef.current;
    setRestorationResolved(false);
    setRestoreError(null);
    try {
      const conversation = await getConversation(id);
      if (request !== requestRef.current) return false;
      activeConversationIdRef.current = id;
      setConversationId(id);
      const saved = readActiveChatSession(userId);
      setMessages(reconcileConversationMessages(conversation, saved?.conversationId === id ? saved.messages : []));
      return true;
    } catch {
      if (request === requestRef.current) {
        setRestoreError("Could not open this chat. Please try again.");
      }
      return false;
    } finally {
      if (request === requestRef.current) setRestorationResolved(true);
    }
  }, [userId]);

  return {
    openConversation,
    restoreError,
    conversationId: sessionOwner === userId ? conversationId : undefined,
    messages: sessionOwner === userId ? messages : [],
    restorationResolved: sessionOwner === userId && restorationResolved,
    resetConversationState,
    setConversationId,
    setMessages,
  };
};
