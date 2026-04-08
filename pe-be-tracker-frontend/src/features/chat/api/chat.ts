import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { type Workout } from "@/features/workouts";

export interface UploadedAttachment {
  attachment_id: number;
  mime_type: string;
  filename: string;
}

export interface ChatApiPart {
  type: "text" | "image";
  text?: string;
  attachment_id?: number;
  mime_type?: string;
  filename?: string;
}

export interface ChatApiMessage {
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: ChatApiPart[];
}

export interface ChatApiWorkoutCreatedEvent {
  type: "workout_created";
  title?: string | null;
  cta_label?: string | null;
  workout: {
    id: Workout["id"];
    name: string | null;
    notes: string | null;
    start_time: string;
    end_time: string | null;
  };
}

export interface ChatResponse {
  message: string;
  conversation_id: number;
  events: ChatApiWorkoutCreatedEvent[];
}

export interface ConversationListItem {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  messages?: undefined;
}

export interface ConversationMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  parts: ChatApiPart[];
}

export interface ConversationDetail {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  messages: ConversationMessage[];
}

interface ConversationListResponse {
  conversations: ConversationListItem[];
  total: number;
  limit: number;
  offset: number;
}

export const uploadChatAttachment = async (
  file: File,
): Promise<UploadedAttachment> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<UploadedAttachment>(
    endpoints.chatAttachments,
    formData,
  );
  return response.data;
};

export const sendChatMessage = async (
  messages: ChatApiMessage[],
  conversationId?: number,
): Promise<ChatResponse> => {
  const response = await api.post<ChatResponse>(endpoints.chat, {
    messages,
    conversation_id: conversationId,
  });
  return response.data;
};

export const getConversationHistory = async (): Promise<ConversationListItem[]> => {
  const response = await api.get<ConversationListResponse>(endpoints.conversations);
  return response.data.conversations;
};

export const getConversation = async (
  conversationId: number,
): Promise<ConversationDetail> => {
  const response = await api.get<ConversationDetail>(
    endpoints.conversationById(conversationId),
  );
  return response.data;
};
