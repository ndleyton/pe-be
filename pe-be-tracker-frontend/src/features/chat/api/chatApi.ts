import axios from "axios";

import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";

import {
  type ChatApiExerciseSubstitutionsEvent,
  type ChatApiMessage,
  type ChatApiRoutineCreatedEvent,
  type ChatApiWorkoutCreatedEvent,
  type ConversationResponse,
} from "../types";

export interface UploadedAttachment {
  attachment_id: number;
  mime_type: string;
  filename: string;
}

export interface ChatResponse {
  message: string;
  conversation_id: number;
  events?: Array<
    | ChatApiWorkoutCreatedEvent
    | ChatApiRoutineCreatedEvent
    | ChatApiExerciseSubstitutionsEvent
  >;
}

export const uploadChatAttachment = async (
  file: File,
): Promise<UploadedAttachment> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(endpoints.chatAttachments, formData);
  return response.data;
};

type ChatStreamEvent =
  | { type: "delta"; text: string }
  | ({ type: "done" } & ChatResponse)
  | { type: "error"; detail: string };

export const parseChatStream = (text: string): ChatStreamEvent[] =>
  text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ChatStreamEvent);

/** Sends a chat turn via the NDJSON stream endpoint, reporting text as it arrives. */
export const sendChatMessage = async (
  messages: ChatApiMessage[],
  conversationId?: number,
  onDelta?: (text: string) => void,
): Promise<ChatResponse> => {
  let consumed = 0;
  let body: string;
  try {
    const response = await api.post<string>(
      endpoints.chatStream,
      { messages, conversation_id: conversationId },
      {
        responseType: "text",
        onDownloadProgress: ({ event }) => {
          const text: unknown = (event?.target as XMLHttpRequest | undefined)
            ?.responseText;
          if (typeof text !== "string") return;
          const end = text.lastIndexOf("\n") + 1;
          if (end <= consumed) return;
          for (const streamEvent of parseChatStream(text.slice(consumed, end))) {
            if (streamEvent.type === "delta") onDelta?.(streamEvent.text);
          }
          consumed = end;
        },
      },
    );
    body = response.data;
  } catch (error) {
    // Text responseType leaves error bodies unparsed; restore `{ detail }`.
    if (axios.isAxiosError(error) && typeof error.response?.data === "string") {
      try {
        error.response.data = JSON.parse(error.response.data);
      } catch {
        // Keep the raw body.
      }
    }
    throw error;
  }

  const result = parseChatStream(body).find(
    (streamEvent) => streamEvent.type !== "delta",
  );
  if (result?.type === "done") {
    const { type: _type, ...response } = result;
    return response;
  }
  const detail = result?.detail ?? "The chat response ended unexpectedly.";
  throw Object.assign(new Error(detail), { response: { data: { detail } } });
};

export const getConversation = async (
  conversationId: number,
): Promise<ConversationResponse> => {
  const response = await api.get(endpoints.chatConversationById(conversationId));
  return response.data;
};

export const getConversations = async (offset = 0): Promise<{
  conversations: ConversationResponse[];
  total: number;
  limit: number;
  offset: number;
}> => {
  const response = await api.get(endpoints.chatConversations, {
    params: { offset, limit: 20 },
  });
  return response.data;
};
