import { type ChatMessage, type PersistedChatMessage } from "../types";

export const ACTIVE_CHAT_SESSION_KEY = "chat:active-session";

const getSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const parseTimestamp = (value: string): Date => {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;
};

const isPersistedChatMessage = (value: unknown): value is PersistedChatMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedChatMessage>;
  return (
    typeof candidate.id === "string"
    && (candidate.role === "user"
      || candidate.role === "assistant"
      || candidate.role === "system")
    && typeof candidate.content === "string"
    && typeof candidate.timestamp === "string"
  );
};

const serializeChatMessage = (message: ChatMessage): PersistedChatMessage => ({
  ...message,
  timestamp: message.timestamp.toISOString(),
});

const deserializeChatMessage = (
  message: PersistedChatMessage,
): ChatMessage => ({
  ...message,
  timestamp: parseTimestamp(message.timestamp),
});

interface PersistedActiveChatSession {
  conversationId: number;
  messages: PersistedChatMessage[];
}

export interface ActiveChatSession {
  conversationId: number;
  messages: ChatMessage[];
}

export const persistActiveChatSession = (
  session: ActiveChatSession,
): void => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    const payload: PersistedActiveChatSession = {
      conversationId: session.conversationId,
      messages: session.messages.map(serializeChatMessage),
    };
    storage.setItem(ACTIVE_CHAT_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
};

export const readActiveChatSession = (): ActiveChatSession | null => {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(ACTIVE_CHAT_SESSION_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<PersistedActiveChatSession>;
    if (
      typeof parsed.conversationId !== "number"
      || !Array.isArray(parsed.messages)
      || !parsed.messages.every(isPersistedChatMessage)
    ) {
      storage.removeItem(ACTIVE_CHAT_SESSION_KEY);
      return null;
    }

    return {
      conversationId: parsed.conversationId,
      messages: parsed.messages.map(deserializeChatMessage),
    };
  } catch {
    try {
      storage.removeItem(ACTIVE_CHAT_SESSION_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
};

export const clearActiveChatSession = (): void => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(ACTIVE_CHAT_SESSION_KEY);
  } catch {
    /* ignore */
  }
};
