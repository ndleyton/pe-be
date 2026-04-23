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

export const sendChatMessage = async (
  messages: ChatApiMessage[],
  conversationId?: number,
): Promise<ChatResponse> => {
  const response = await api.post(endpoints.chat, {
    messages,
    conversation_id: conversationId,
  });
  return response.data;
};

export const getConversation = async (
  conversationId: number,
): Promise<ConversationResponse> => {
  const response = await api.get(endpoints.chatConversationById(conversationId));
  return response.data;
};
