import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Dumbbell, ImagePlus, MessageCircle, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocation, useNavigate } from "react-router-dom";

import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAuthStore } from "@/stores";

import { buildAttachmentUrl } from "../lib/chatAttachments";
import { normalizeChatCopy } from "../lib/chatCopy";
import { mapConversationToChatMessages } from "../lib/chatConversation";
import { extractErrorMessage } from "../lib/chatErrors";
import { extractChatEvents } from "../lib/chatEvents";
import {
  clearActiveChatSession,
  persistActiveChatSession,
  readActiveChatSession,
} from "../lib/chatSession";
import {
  ChatWorkoutWidget,
  ChatRoutineWidget,
  ChatExerciseSubstitutionsWidget,
} from "../components";
import {
  type ChatMessage,
  type TextMessagePart,
  type ImageMessagePart,
  type UIMessagePart,
  type ChatPageLocationState,
  type ChatApiMessage,
  type ChatApiPart,
  type ChatApiWorkoutCreatedEvent,
  type ChatApiRoutineCreatedEvent,
  type ChatApiExerciseSubstitutionsEvent,
  type ExerciseSubstitutionChatIntent,
  type ConversationResponse,
} from "../types";

interface ChatResponse {
  message: string;
  conversation_id: number;
  events?: Array<
    | ChatApiWorkoutCreatedEvent
    | ChatApiRoutineCreatedEvent
    | ChatApiExerciseSubstitutionsEvent
  >;
}

interface PendingAttachment {
  localId: string;
  file: File;
  previewUrl: string;
}

interface UploadedAttachment {
  attachment_id: number;
  mime_type: string;
  filename: string;
}

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
const SUBSTITUTION_FOLLOW_UP_QUESTION = (exerciseTypeName: string) =>
  `I can help with alternatives to ${exerciseTypeName}. What equipment do you have available, or what do you want to avoid?`;
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

const uploadChatAttachment = async (
  file: File,
): Promise<UploadedAttachment> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(endpoints.chatAttachments, formData);
  return response.data;
};

const sendChatMessage = async (
  messages: ChatApiMessage[],
  conversationId?: number,
): Promise<ChatResponse> => {
  const response = await api.post(endpoints.chat, {
    messages,
    conversation_id: conversationId,
  });
  return response.data;
};

const getConversation = async (
  conversationId: number,
): Promise<ConversationResponse> => {
  const response = await api.get(endpoints.chatConversationById(conversationId));
  return response.data;
};

const ChatPage = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [pendingSubstitutionIntent, setPendingSubstitutionIntent] =
    useState<ExerciseSubstitutionChatIntent | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>(
    [],
  );
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [conversationRestorationResolved, setConversationRestorationResolved] =
    useState(!isAuthenticated);
  const [isRestoringConversation, setIsRestoringConversation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seededPromptHandledRef = useRef(false);
  const conversationRestoreAttemptedRef = useRef(false);
  const activeConversationIdRef = useRef<number | undefined>(undefined);
  const routeState = location.state as ChatPageLocationState | null;
  const chatIntent = routeState?.chatIntent;
  const autoStartChatIntent = routeState?.autoStartChatIntent === true;

  const examplePrompts = useMemo(
    () => [
      "I did 3 sets of bench press: 135lbs x 8, 155lbs x 6, 165lbs x 4. Then squats: 3 sets of 185lbs x 10.",
      "What exercises should I do to improve my bench press?",
      "I ran 3 miles in 24 minutes today, feeling great!",
      "Can you suggest a good leg workout based on my recent training?",
    ],
    [],
  );

  const chatMutation = useMutation({
    mutationFn: ({
      messages: chatMessages,
      conversationId: convId,
    }: {
      messages: ChatApiMessage[];
      conversationId?: number;
    }) => sendChatMessage(chatMessages, convId),
    onSuccess: (response) => {
      if (response.conversation_id && response.conversation_id !== conversationId) {
        activeConversationIdRef.current = response.conversation_id;
        setConversationId(response.conversation_id);
      }

      setMessages((prev) => [
        ...prev,
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
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    },
    onError: (error) => {
      const message = normalizeChatCopy(
        extractErrorMessage(
          error,
          "Sorry, I encountered an error processing your message. Please try again.",
        ),
      );

      setMessages((prev) => [
        ...prev,
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

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);

    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const clearPendingAttachments = useCallback(() => {
    pendingAttachments.forEach((attachment) => {
      URL.revokeObjectURL(attachment.previewUrl);
    });
    setPendingAttachments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [pendingAttachments]);

  const resetConversationState = useCallback(() => {
    activeConversationIdRef.current = undefined;
    clearPendingAttachments();
    clearActiveChatSession();
    setMessages([]);
    setConversationId(undefined);
    setInputValue("");
    setIsLoading(false);
    setAttachmentError(null);
    setPendingSubstitutionIntent(null);
  }, [clearPendingAttachments]);

  const buildUserParts = async (
    messageContent: string,
    attachments: PendingAttachment[],
    apiTextOverride?: string,
  ): Promise<{ uiParts: UIMessagePart[]; apiParts: ChatApiPart[] }> => {
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
      uiParts: [...imageUiParts, ...textUiParts],
      apiParts,
    };
  };

  const processMessage = useCallback(async (messageContent: string) => {
    const trimmedMessage = messageContent.trim();
    if ((!trimmedMessage && pendingAttachments.length === 0) || isLoading) {
      return;
    }

    setIsLoading(true);
    setAttachmentError(null);

    const attachmentsSnapshot = [...pendingAttachments];
    setInputValue("");

    if (!isAuthenticated) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-user`,
          role: "user",
          content: trimmedMessage,
          parts: trimmedMessage ? [{ type: "text", text: trimmedMessage }] : [],
          timestamp: new Date(),
        },
      ]);

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-response`,
            role: "assistant",
            content: "Chat is available for logged-in users. Please sign in to continue.",
            parts: [
              {
                type: "text",
                text: "Chat is available for logged-in users. Please sign in to continue.",
              },
            ],
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
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
      const { uiParts, apiParts } = await buildUserParts(
        trimmedMessage,
        attachmentsSnapshot,
        apiMessageContent,
      );

      setMessages((prev) => [
        ...prev,
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
          setPendingSubstitutionIntent(null);
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
  }, [
    chatMutation,
    clearPendingAttachments,
    conversationId,
    isAuthenticated,
    isLoading,
    pendingSubstitutionIntent,
    pendingAttachments,
  ]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const invalidType = files.find(
      (file) => !ALLOWED_ATTACHMENT_TYPES.includes(file.type as (typeof ALLOWED_ATTACHMENT_TYPES)[number]),
    );
    if (invalidType) {
      setAttachmentError(
        `${invalidType.name} is not supported. Use PNG, JPEG, or WebP.`,
      );
      event.target.value = "";
      return;
    }

    const oversized = files.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setAttachmentError(
        `${oversized.name} is too large. The limit is 10 MB per image.`,
      );
      event.target.value = "";
      return;
    }

    setAttachmentError(null);

    setPendingAttachments((current) => {
      const remainingSlots = MAX_ATTACHMENTS - current.length;
      const nextFiles = files.slice(0, Math.max(remainingSlots, 0));
      const nextAttachments = nextFiles.map((file) => ({
        localId: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...current, ...nextAttachments];
    });
  };

  const handleRemoveAttachment = (localId: string) => {
    setPendingAttachments((current) => {
      const attachment = current.find((item) => item.localId === localId);
      if (attachment) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      return current.filter((item) => item.localId !== localId);
    });
  };

  const handleSendMessage = async () => {
    await processMessage(inputValue);
  };

  const handleExamplePrompt = async (prompt: string) => {
    setInputValue(prompt);
    setTimeout(async () => {
      await processMessage(prompt);
    }, 100);
  };

  const handleStartNewChat = () => {
    resetConversationState();
  };

  useEffect(() => {
    if (!isAuthenticated) {
      conversationRestoreAttemptedRef.current = false;
      activeConversationIdRef.current = undefined;
      clearActiveChatSession();
      setConversationRestorationResolved(true);
      setIsRestoringConversation(false);
      return;
    }

    if (conversationRestoreAttemptedRef.current) {
      return;
    }

    conversationRestoreAttemptedRef.current = true;
    setConversationRestorationResolved(false);
    const storedSession = readActiveChatSession();

    if (!storedSession?.conversationId) {
      setConversationRestorationResolved(true);
      return;
    }

    let cancelled = false;
    const restoreConversation = async () => {
      try {
        setIsRestoringConversation(true);
        const conversation = await getConversation(storedSession.conversationId);

        if (cancelled) {
          return;
        }

        if (storedSession.messages.length === 0) {
          activeConversationIdRef.current = conversation.id;
          setMessages(mapConversationToChatMessages(conversation));
          setConversationId(conversation.id);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const status =
          typeof error === "object"
          && error !== null
          && "response" in error
          && typeof error.response === "object"
          && error.response !== null
          && "status" in error.response
          && typeof error.response.status === "number"
            ? error.response.status
            : null;

        if (
          status === 404
          && (
            activeConversationIdRef.current === undefined
            || activeConversationIdRef.current === storedSession.conversationId
          )
        ) {
          resetConversationState();
        }
      } finally {
        if (!cancelled) {
          setIsRestoringConversation(false);
          setConversationRestorationResolved(true);
        }
      }
    };

    if (storedSession.messages.length > 0) {
      activeConversationIdRef.current = storedSession.conversationId;
      setMessages(storedSession.messages);
      setConversationId(storedSession.conversationId);
      setConversationRestorationResolved(true);
      void restoreConversation();

      return () => {
        cancelled = true;
      };
    }

    void restoreConversation();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, resetConversationState]);

  useEffect(() => {
    if (!conversationRestorationResolved) {
      return;
    }

    if (!isAuthenticated || !conversationId || messages.length === 0) {
      clearActiveChatSession();
      return;
    }

    persistActiveChatSession({
      conversationId,
      messages,
    });
  }, [
    conversationId,
    conversationRestorationResolved,
    isAuthenticated,
    messages,
  ]);

  useEffect(() => {
    if (
      !conversationRestorationResolved ||
      !autoStartChatIntent ||
      !chatIntent ||
      seededPromptHandledRef.current ||
      messages.length > 0
    ) {
      return;
    }

    seededPromptHandledRef.current = true;
    setPendingSubstitutionIntent(chatIntent);
    const followUpQuestion = SUBSTITUTION_FOLLOW_UP_QUESTION(
      chatIntent.exerciseTypeName,
    );
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-assistant-intent`,
        role: "assistant",
        content: followUpQuestion,
        parts: [
          {
            type: "text",
            text: followUpQuestion,
          },
        ],
        timestamp: new Date(),
      },
    ]);
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      {
        replace: true,
        state: routeState
          ? { ...routeState, autoStartChatIntent: false }
          : routeState,
      },
    );
  }, [
    autoStartChatIntent,
    chatIntent,
    conversationRestorationResolved,
    location.hash,
    location.pathname,
    location.search,
    messages.length,
    navigate,
    routeState,
  ]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleSendMessage();
  };

  const renderMessageParts = (message: ChatMessage) => {
    const parts = message.parts ?? [];
    const imageParts = parts.filter(
      (part): part is ImageMessagePart => part.type === "image",
    );
    const textParts = parts.filter(
      (part): part is TextMessagePart => part.type === "text",
    );
    const markdown = textParts.map((part) => part.text).join("\n\n") || message.content;

    return (
      <>
        {imageParts.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {imageParts.map((part) => (
              <img
                key={`${message.id}-${part.attachment_id}`}
                src={part.url}
                alt={part.filename || "Chat attachment"}
                className="border-border/30 max-h-64 w-full rounded-2xl border object-cover"
              />
            ))}
          </div>
        )}
        <div className="text-sm">
          {message.role === "assistant" ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children, ...props }) => (
                  <p className="mb-2 leading-relaxed last:mb-0" {...props}>
                    {children}
                  </p>
                ),
                ul: ({ children, ...props }) => (
                  <ul className="mb-2 list-inside list-disc space-y-1" {...props}>
                    {children}
                  </ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol
                    className="mb-2 list-inside list-decimal space-y-1"
                    {...props}
                  >
                    {children}
                  </ol>
                ),
                li: ({ children, ...props }) => (
                  <li className="mb-0.5" {...props}>
                    {children}
                  </li>
                ),
                strong: ({ children, ...props }) => (
                  <strong className="font-semibold" {...props}>
                    {children}
                  </strong>
                ),
                em: ({ children, ...props }) => (
                  <em className="italic" {...props}>
                    {children}
                  </em>
                ),
                code: ({ children, ...props }) => {
                  const isInline = !props.className?.includes("language-");
                  return isInline ? (
                    <code
                      className="bg-background/50 rounded-md px-1.5 py-0.5 font-mono text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code {...props}>{children}</code>
                  );
                },
                pre: ({ children, ...props }) => (
                  <pre
                    className="bg-background/50 mb-2 overflow-x-auto rounded-lg p-2 text-xs"
                    {...props}
                  >
                    {children}
                  </pre>
                ),
                h1: ({ children, ...props }) => (
                  <h1 className="mb-2 text-base font-bold" {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="mb-1.5 text-sm font-bold" {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="mb-1 text-sm font-semibold" {...props}>
                    {children}
                  </h3>
                ),
                blockquote: ({ children, ...props }) => (
                  <blockquote
                    className="border-border my-2 border-l-2 pl-3 italic"
                    {...props}
                  >
                    {children}
                  </blockquote>
                ),
              }}
            >
              {markdown || ""}
            </ReactMarkdown>
          ) : (
            <p className="leading-relaxed">{markdown}</p>
          )}
        </div>
      </>
    );
  };

  const renderMessageWidget = (message: ChatMessage) => {
    if (message.role !== "assistant") {
      return null;
    }

    if (!message.events?.length) {
      return null;
    }

    return message.events.map((event, index) => {
      if (event.type === "workout_created") {
        return <ChatWorkoutWidget key={`${message.id}-widget-${index}`} event={event} />;
      }
      if (event.type === "routine_created") {
        return <ChatRoutineWidget key={`${message.id}-widget-${index}`} event={event} />;
      }
      if (event.type === "exercise_substitutions_recommended") {
        return (
          <ChatExerciseSubstitutionsWidget
            key={`${message.id}-widget-${index}`}
            event={event}
          />
        );
      }
      return null;
    });
  };

  return (
    <div className="bg-background flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-4rem)]">
      <div className="bg-card border-border/20 flex shrink-0 items-center gap-3 border-b px-4 py-3 shadow-sm">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
          <Dumbbell className="text-primary h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base leading-tight font-semibold">
            Personal Bestie
          </h1>
          <p className="text-muted-foreground text-xs">Text + image coaching</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={handleStartNewChat}
          disabled={messages.length === 0 && !conversationId}
        >
          New chat
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto max-w-4xl">
          {isAuthenticated && !conversationRestorationResolved && (
            <div className="px-4 py-8 text-center">
              <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <Bot className="text-primary h-8 w-8" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Restoring chat</h3>
              <p className="text-muted-foreground text-sm">
                Loading your latest conversation for this session.
              </p>
            </div>
          )}

          {conversationRestorationResolved && messages.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <Bot className="text-primary h-8 w-8" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Meet Personal Bestie
              </h3>
              <p className="text-muted-foreground mb-6 text-sm">
                Ask questions, log workouts, get coaching, or create a personalized routine just for you.
              </p>
              <div className="mx-auto max-w-md space-y-2">
                <p className="text-muted-foreground mb-3 text-xs font-medium">
                  Try these examples:
                </p>
                {examplePrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleExamplePrompt(prompt)}
                    className="bg-muted/50 hover:bg-muted w-full rounded-2xl px-4 py-3 text-left text-sm transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {!isAuthenticated && (
                <div className="bg-destructive/10 mx-auto mt-6 max-w-md rounded-2xl px-4 py-3">
                  <p className="text-destructive text-sm">
                    Sign in to use chat and image uploads. This feature is for
                    logged-in users.
                  </p>
                </div>
              )}
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-2 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex max-w-[88%] gap-2 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {message.role !== "user" && (
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${message.role === "system" ? "bg-accent/20" : "bg-muted"
                      }`}
                  >
                    <Bot className="text-muted-foreground h-4 w-4" />
                  </div>
                )}
                <div
                  className={`px-4 py-2.5 ${message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                    : message.role === "system"
                      ? "bg-accent/50 text-accent-foreground rounded-2xl shadow-sm"
                      : "bg-muted/80 text-foreground rounded-2xl rounded-tl-sm shadow-sm"
                    }`}
                >
                  {renderMessageParts(message)}
                  {renderMessageWidget(message)}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="mb-2 flex gap-2">
              <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                <Bot className="text-muted-foreground h-4 w-4" />
              </div>
              <div className="bg-muted/80 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"></div>
                  <div
                    className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {isRestoringConversation && conversationRestorationResolved && messages.length > 0 && (
            <div className="text-muted-foreground px-2 py-1 text-center text-xs">
              Syncing saved conversation...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-border/20 bg-card shrink-0 border-t p-3 shadow-sm">
        <div className="mx-auto max-w-4xl">
          {pendingAttachments.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {pendingAttachments.map((attachment) => (
                <div
                  key={attachment.localId}
                  className="bg-muted relative h-20 w-20 flex-none overflow-hidden rounded-2xl border"
                >
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.file.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(attachment.localId)}
                    className="bg-background/80 absolute right-1 top-1 rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachmentError && (
            <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {attachmentError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-11 shrink-0 rounded-xl p-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || pendingAttachments.length >= MAX_ATTACHMENTS}
            >
              <ImagePlus className="h-5 w-5" />
            </Button>
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Message..."
              className="border-border/30 bg-muted/30 focus:bg-background h-11 flex-1 rounded-xl transition-colors"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={
                isLoading ||
                (!inputValue.trim() && pendingAttachments.length === 0)
              }
              className="h-11 w-11 shrink-0 rounded-xl p-0"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
