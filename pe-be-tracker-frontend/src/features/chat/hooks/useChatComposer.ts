import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMutation } from "@tanstack/react-query";

import {
  sendChatMessage,
  uploadChatAttachment,
} from "../api/chatApi";
import {
  ALLOWED_CHAT_ATTACHMENT_TYPES,
  buildAttachmentUrl,
  MAX_CHAT_ATTACHMENTS,
  MAX_CHAT_ATTACHMENT_BYTES,
} from "../lib/chatAttachments";
import { normalizeChatCopy } from "../lib/chatCopy";
import { extractErrorMessage } from "../lib/chatErrors";
import { extractChatEvents } from "../lib/chatEvents";
import {
  type ChatApiMessage,
  type ChatApiPart,
  type ChatMessage,
  type ExerciseSubstitutionChatIntent,
  type PendingAttachment,
  type UIMessagePart,
} from "../types";

const LOGGED_OUT_COPY =
  "Chat is available for logged-in users. Please sign in to continue.";

const buildGroundedSubstitutionRequest = (
  intent: ExerciseSubstitutionChatIntent,
  contextNotes: string,
) => {
  const serializedContext = JSON.stringify({
    exercise_type_id: intent.exerciseTypeId,
    exercise_type_name: intent.exerciseTypeName,
    context_notes: contextNotes,
  });

  return [
    "Use the grounded exercise substitution flow for this request.",
    `Exercise context: ${serializedContext}`,
    "The required follow-up question has already been asked and answered.",
    "Call recommend_exercise_substitutions with the provided exercise_type_id and the user's answer as context_notes.",
    "Only recommend exercises returned by that tool, then respond conversationally about those grounded options.",
  ].join("\n");
};

const revokeAttachmentPreviews = (attachments: PendingAttachment[]) => {
  attachments.forEach((attachment) => {
    URL.revokeObjectURL(attachment.previewUrl);
  });
};

interface UseChatComposerOptions {
  clearPendingSubstitutionIntent: () => void;
  conversationId?: number;
  isAuthenticated: boolean;
  pendingSubstitutionIntent: ExerciseSubstitutionChatIntent | null;
  setConversationId: Dispatch<SetStateAction<number | undefined>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

export const useChatComposer = ({
  clearPendingSubstitutionIntent,
  conversationId,
  isAuthenticated,
  pendingSubstitutionIntent,
  setConversationId,
  setMessages,
}: UseChatComposerOptions) => {
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>(
    [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const guestResponseTimeoutRef = useRef<number | null>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);

  const clearGuestResponseTimeout = useCallback(() => {
    if (guestResponseTimeoutRef.current !== null) {
      window.clearTimeout(guestResponseTimeoutRef.current);
      guestResponseTimeoutRef.current = null;
    }
  }, []);

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments((current) => {
      revokeAttachmentPreviews(current);
      return [];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      clearGuestResponseTimeout();
      revokeAttachmentPreviews(pendingAttachmentsRef.current);
    };
  }, [clearGuestResponseTimeout]);

  const chatMutation = useMutation({
    mutationFn: ({
      conversationId: nextConversationId,
      messages,
    }: {
      conversationId?: number;
      messages: ChatApiMessage[];
    }) => sendChatMessage(messages, nextConversationId),
    onSuccess: (response) => {
      setConversationId((current) =>
        current === response.conversation_id ? current : response.conversation_id,
      );
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: response.message,
          parts: [{ type: "text", text: response.message }],
          events: extractChatEvents(response.events),
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    },
    onError: (error) => {
      const message = normalizeChatCopy(
        extractErrorMessage(
          error,
          "Sorry, I encountered an error processing your message. Please try again.",
        ),
      );

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content: message,
          parts: [
            {
              type: "text",
              text: message,
            },
          ],
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    },
  });

  const buildUserParts = useCallback(
    async (
      messageContent: string,
      attachments: PendingAttachment[],
      apiTextOverride?: string,
    ): Promise<{ apiParts: ChatApiPart[]; uiParts: UIMessagePart[] }> => {
      const uploadedAttachments = await Promise.all(
        attachments.map((attachment) => uploadChatAttachment(attachment.file)),
      );

      const imageUiParts: UIMessagePart[] = attachments.map((_, index) => ({
        type: "image",
        attachment_id: uploadedAttachments[index].attachment_id,
        mime_type: uploadedAttachments[index].mime_type,
        filename: uploadedAttachments[index].filename,
        url: buildAttachmentUrl(uploadedAttachments[index].attachment_id),
      }));

      const textPart = messageContent.trim();
      const apiText = apiTextOverride?.trim() ?? textPart;
      const textUiParts: UIMessagePart[] = textPart
        ? [{ type: "text", text: textPart }]
        : [];

      const apiParts: ChatApiPart[] = [
        ...uploadedAttachments.map((attachment) => ({
          type: "image" as const,
          attachment_id: attachment.attachment_id,
        })),
        ...(apiText ? [{ type: "text" as const, text: apiText }] : []),
      ];

      return {
        apiParts,
        uiParts: [...imageUiParts, ...textUiParts],
      };
    },
    [],
  );

  const processMessage = useCallback(
    async (messageContent: string) => {
      const trimmedMessage = messageContent.trim();

      if ((!trimmedMessage && pendingAttachments.length === 0) || isLoading) {
        return;
      }

      clearGuestResponseTimeout();
      setIsLoading(true);
      setAttachmentError(null);

      const attachmentsSnapshot = [...pendingAttachments];
      setInputValue("");

      if (!isAuthenticated) {
        setMessages((current) => [
          ...current,
          {
            id: `${Date.now()}-user`,
            role: "user",
            content: trimmedMessage,
            parts: trimmedMessage ? [{ type: "text", text: trimmedMessage }] : [],
            timestamp: new Date(),
          },
        ]);
        clearPendingAttachments();

        guestResponseTimeoutRef.current = window.setTimeout(() => {
          setMessages((current) => [
            ...current,
            {
              id: `${Date.now()}-response`,
              role: "assistant",
              content: LOGGED_OUT_COPY,
              parts: [
                {
                  type: "text",
                  text: LOGGED_OUT_COPY,
                },
              ],
              timestamp: new Date(),
            },
          ]);
          setIsLoading(false);
          guestResponseTimeoutRef.current = null;
        }, 400);

        return;
      }

      try {
        const substitutionIntentForMessage = pendingSubstitutionIntent;
        const apiMessageContent = substitutionIntentForMessage
          ? buildGroundedSubstitutionRequest(
              substitutionIntentForMessage,
              trimmedMessage,
            )
          : undefined;
        const requestContent = (apiMessageContent ?? trimmedMessage) || undefined;
        const { apiParts, uiParts } = await buildUserParts(
          trimmedMessage,
          attachmentsSnapshot,
          apiMessageContent,
        );

        setMessages((current) => [
          ...current,
          {
            id: `${Date.now()}-user`,
            role: "user",
            content: trimmedMessage,
            parts: uiParts,
            timestamp: new Date(),
          },
        ]);

        clearPendingAttachments();

        try {
          await chatMutation.mutateAsync({
            messages: [
              {
                role: "user",
                content: requestContent,
                parts: apiParts.length > 0 ? apiParts : undefined,
              },
            ],
            conversationId,
          });

          if (substitutionIntentForMessage) {
            clearPendingSubstitutionIntent();
          }
        } catch {
          // Mutation errors are handled by the configured mutation callbacks.
        }
      } catch (error) {
        setAttachmentError(
          extractErrorMessage(
            error,
            "I couldn't upload one of the images. Check the file type/size and try again.",
          ),
        );
        setIsLoading(false);
      }
    },
    [
      buildUserParts,
      chatMutation,
      clearGuestResponseTimeout,
      clearPendingAttachments,
      clearPendingSubstitutionIntent,
      clearPendingAttachments,
      conversationId,
      isAuthenticated,
      isLoading,
      pendingAttachments,
      pendingSubstitutionIntent,
      setMessages,
    ],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);

      if (files.length === 0) {
        return;
      }

      const invalidType = files.find(
        (file) =>
          !ALLOWED_CHAT_ATTACHMENT_TYPES.includes(
            file.type as (typeof ALLOWED_CHAT_ATTACHMENT_TYPES)[number],
          ),
      );

      if (invalidType) {
        setAttachmentError(
          `${invalidType.name} is not supported. Use PNG, JPEG, or WebP.`,
        );
        event.target.value = "";
        return;
      }

      const oversized = files.find((file) => file.size > MAX_CHAT_ATTACHMENT_BYTES);

      if (oversized) {
        setAttachmentError(
          `${oversized.name} is too large. The limit is 10 MB per image.`,
        );
        event.target.value = "";
        return;
      }

      setAttachmentError(null);

      setPendingAttachments((current) => {
        const remainingSlots = MAX_CHAT_ATTACHMENTS - current.length;
        const nextFiles = files.slice(0, Math.max(remainingSlots, 0));
        const nextAttachments = nextFiles.map((file) => ({
          localId: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }));

        return [...current, ...nextAttachments];
      });
    },
    [],
  );

  const handleRemoveAttachment = useCallback((localId: string) => {
    setPendingAttachments((current) => {
      const attachment = current.find((item) => item.localId === localId);

      if (attachment) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      return current.filter((item) => item.localId !== localId);
    });
  }, []);

  const handleSubmitMessage = useCallback(
    async (messageContent?: string) => {
      await processMessage(messageContent ?? inputValue);
    },
    [inputValue, processMessage],
  );

  const handleExamplePrompt = useCallback(
    (prompt: string) => {
      setInputValue(prompt);
      window.setTimeout(() => {
        void processMessage(prompt);
      }, 100);
    },
    [processMessage],
  );

  const resetComposer = useCallback(() => {
    clearGuestResponseTimeout();
    clearPendingAttachments();
    setAttachmentError(null);
    setInputValue("");
    setIsLoading(false);
  }, [clearGuestResponseTimeout, clearPendingAttachments]);

  return {
    attachmentError,
    canAddAttachments: pendingAttachments.length < MAX_CHAT_ATTACHMENTS,
    canSubmitMessage:
      !isLoading &&
      (Boolean(inputValue.trim()) || pendingAttachments.length > 0),
    clearPendingAttachments,
    fileInputRef,
    handleExamplePrompt,
    handleFileChange,
    handleInputChange: setInputValue,
    handleRemoveAttachment,
    handleSubmitMessage,
    inputValue,
    isLoading,
    pendingAttachments,
    resetComposer,
  };
};
