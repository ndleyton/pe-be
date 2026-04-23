import { config } from "@/app/config/env";
import { endpoints } from "@/shared/api/endpoints";

export const buildAttachmentUrl = (attachmentId: number) =>
  `${config.apiBaseUrl}${endpoints.chatAttachmentById(attachmentId)}`;
