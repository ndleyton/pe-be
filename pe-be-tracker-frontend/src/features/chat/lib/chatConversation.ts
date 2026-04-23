import {
  type ChatMessage,
  type ConversationMessageResponse,
  type ConversationResponse,
  type ImageMessagePart,
  type TextMessagePart,
} from "../types";
import { buildAttachmentUrl } from "./chatAttachments";

const normalizeChatRole = (role: string): ChatMessage["role"] => {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }

  return "system";
};

const parseTimestamp = (value: string): Date => {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;
};

const parseConversationParts = (
  message: ConversationMessageResponse,
): ChatMessage["parts"] => {
  if (!message.parts?.length) {
    return message.content
      ? [{ type: "text", text: message.content } satisfies TextMessagePart]
      : [];
  }

  return message.parts.reduce<NonNullable<ChatMessage["parts"]>>((acc, part) => {
    if (part.type === "image" && typeof part.attachment_id === "number") {
      acc.push({
        type: "image",
        attachment_id: part.attachment_id,
        mime_type: part.mime_type ?? undefined,
        filename: part.filename ?? undefined,
        url: buildAttachmentUrl(part.attachment_id),
      } satisfies ImageMessagePart);
      return acc;
    }

    if (part.type === "text" && part.text) {
      acc.push({
        type: "text",
        text: part.text,
      } satisfies TextMessagePart);
    }

    return acc;
  }, []);
};

export const mapConversationMessageToChatMessage = (
  message: ConversationMessageResponse,
): ChatMessage => {
  const parts = parseConversationParts(message);
  const textContent = parts
    ?.filter((part): part is TextMessagePart => part.type === "text")
    .map((part) => part.text)
    .join("\n\n")
    .trim();

  return {
    id: `conversation-message-${message.id}`,
    role: normalizeChatRole(message.role),
    content: textContent || message.content,
    parts,
    timestamp: parseTimestamp(message.created_at),
  };
};

export const mapConversationToChatMessages = (
  conversation: ConversationResponse,
): ChatMessage[] =>
  (conversation.messages ?? []).map(mapConversationMessageToChatMessage);
