import { config } from "@/app/config/env";
import { endpoints } from "@/shared/api/endpoints";

import type {
  ChatApiMessage,
  ChatApiPart,
  ConversationDetail,
  ConversationMessage,
} from "../api";

export interface TextMessagePart {
  type: "text";
  text: string;
}

export interface ImageMessagePart {
  type: "image";
  attachment_id: number;
  mime_type?: string;
  filename?: string;
  url: string;
}

export type UIMessagePart = TextMessagePart | ImageMessagePart;

export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: UIMessagePart[];
  timestamp: Date;
}

export const buildAttachmentUrl = (attachmentId: number) =>
  `${config.apiBaseUrl}${endpoints.chatAttachmentById(attachmentId)}`;

const mapPartToUiPart = (part: ChatApiPart): UIMessagePart | null => {
  if (part.type === "text") {
    return part.text ? { type: "text", text: part.text } : null;
  }

  if (part.attachment_id == null) {
    return null;
  }

  return {
    type: "image",
    attachment_id: part.attachment_id,
    mime_type: part.mime_type,
    filename: part.filename,
    url: buildAttachmentUrl(part.attachment_id),
  };
};

export const mapConversationMessageToUiMessage = (
  message: ConversationMessage | ChatApiMessage,
  fallbackId: string,
  createdAt?: string,
): UIMessage => {
  const parts =
    message.parts
      ?.map((part) => mapPartToUiPart(part))
      .filter((part): part is UIMessagePart => part !== null) ?? [];

  return {
    id:
      "id" in message && typeof message.id === "number"
        ? `conversation-message-${message.id}`
        : fallbackId,
    role: message.role,
    content: message.content ?? "",
    parts,
    timestamp: new Date(
      ("created_at" in message && message.created_at) || createdAt || Date.now(),
    ),
  };
};

export const mapConversationToUiMessages = (
  conversation: ConversationDetail,
): UIMessage[] =>
  conversation.messages.map((message, index) =>
    mapConversationMessageToUiMessage(
      message,
      `conversation-${conversation.id}-message-${index}`,
    ),
  );
