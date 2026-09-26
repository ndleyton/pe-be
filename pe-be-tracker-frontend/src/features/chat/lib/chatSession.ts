import { type ChatMessage, type PersistedChatMessage } from "../types";

export const ACTIVE_CHAT_SESSION_KEY = "chat:active-session";

const sessionKey = (userId?: number) => userId === undefined
  ? ACTIVE_CHAT_SESSION_KEY
  : `${ACTIVE_CHAT_SESSION_KEY}:${userId}`;

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
  userId?: number,
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
    storage.setItem(sessionKey(userId), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
};

export const readActiveChatSession = (userId?: number): ActiveChatSession | null => {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(sessionKey(userId));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<PersistedActiveChatSession>;
    if (
      typeof parsed.conversationId !== "number"
      || !Array.isArray(parsed.messages)
      || !parsed.messages.every(isPersistedChatMessage)
    ) {
      storage.removeItem(sessionKey(userId));
      return null;
    }

    return {
      conversationId: parsed.conversationId,
      messages: parsed.messages.map(deserializeChatMessage),
    };
  } catch {
    try {
      storage.removeItem(sessionKey(userId));
    } catch {
      /* ignore */
    }
    return null;
  }
};

export const clearActiveChatSession = (userId?: number): void => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(sessionKey(userId));
  } catch {
    /* ignore */
  }
};
