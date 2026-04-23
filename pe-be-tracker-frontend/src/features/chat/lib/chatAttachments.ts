import { config } from "@/app/config/env";
import { endpoints } from "@/shared/api/endpoints";

export const MAX_CHAT_ATTACHMENTS = 4;
export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_CHAT_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const CHAT_ATTACHMENT_ACCEPT = ALLOWED_CHAT_ATTACHMENT_TYPES.join(",");

export const buildAttachmentUrl = (attachmentId: number) =>
  `${config.apiBaseUrl}${endpoints.chatAttachmentById(attachmentId)}`;
