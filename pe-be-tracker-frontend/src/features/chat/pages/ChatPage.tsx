import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Bot,
  Dumbbell,
  History,
  ImagePlus,
  MessageCircle,
  Plus,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";

import {
  getConversation,
  getConversationHistory,
  sendChatMessage,
  uploadChatAttachment,
  type ChatApiMessage,
  type ChatApiPart,
  type ChatApiWorkoutCreatedEvent,
} from "@/features/chat/api";
import {
  buildAttachmentUrl,
  mapConversationToUiMessages,
  type ImageMessagePart,
  type TextMessagePart,
  type UIMessage,
  type UIMessagePart,
} from "@/features/chat/lib/chatMessageMappers";
import { type Workout } from "@/features/workouts";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { useAuthStore } from "@/stores";
import { formatDisplayDate, parseWorkoutDuration } from "@/utils/date";

interface PendingAttachment {
  localId: string;
  file: File;
  previewUrl: string;
}

type WorkoutWidgetData = Pick<
  Workout,
  "id" | "name" | "notes" | "start_time" | "end_time"
>;

interface WorkoutCreatedEvent {
  type: "workout_created";
  title?: string;
  ctaLabel?: string;
  workout: WorkoutWidgetData;
}

type ChatEvent = WorkoutCreatedEvent;

interface ChatMessage extends UIMessage {
  events?: ChatEvent[];
}

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const normalizeChatCopy = (message: string) =>
  message
    .replace(/with Gemini/gi, "with the AI coach")
    .replace(/\bGemini\b/gi, "AI coach");

const parseWorkoutCreatedEvent = (
  event: ChatApiWorkoutCreatedEvent,
): WorkoutCreatedEvent => {
  return {
    type: "workout_created",
    title: event.title ?? undefined,
    ctaLabel: event.cta_label ?? undefined,
    workout: {
      id: event.workout.id,
      name: event.workout.name,
      notes: event.workout.notes,
      start_time: event.workout.start_time,
      end_time: event.workout.end_time,
    },
  };
};

const extractChatEvents = (events?: ChatApiWorkoutCreatedEvent[]): ChatEvent[] =>
  (events ?? []).map(parseWorkoutCreatedEvent);

const ChatWorkoutWidget = ({ event }: { event: WorkoutCreatedEvent }) => {
  const workoutPath = `${NAV_PATHS.WORKOUTS}/${event.workout.id}`;
  const startedAt = formatDisplayDate(event.workout.start_time, {
    includeTime: false,
    includeTimezone: false,
  });
  const duration = parseWorkoutDuration(
    event.workout.start_time,
    event.workout.end_time,
  ).durationText;

  return (
    <div className="bg-background/70 border-border/40 mt-3 rounded-2xl border p-3">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Dumbbell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.16em]">
            {event.title ?? "Workout created"}
          </p>
          <p className="text-foreground mt-1 text-sm font-semibold">
            {event.workout.name || "Traditional Strength Training"}
          </p>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {startedAt && <span>{startedAt}</span>}
            <span>{duration}</span>
          </div>
        </div>
      </div>

      {event.workout.notes && (
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {event.workout.notes}
        </p>
      )}

      <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
        <Link to={workoutPath}>{event.ctaLabel ?? "Open workout"}</Link>
      </Button>
    </div>
  );
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "detail" in error.response.data
  ) {
    const { detail } = error.response.data;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const message = detail
        .map((item) => {
          if (
            typeof item === "object" &&
            item !== null &&
            "msg" in item &&
            typeof item.msg === "string"
          ) {
            return item.msg;
          }
          return null;
        })
        .find((value): value is string => Boolean(value));

      if (message) {
        return message;
      }
    }
  }

  return fallback;
};

const formatConversationTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const getConversationTitle = (title: string | null | undefined) =>
  title?.trim() || "Untitled chat";

const ChatPage = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(
    null,
  );
  const [historyInitialized, setHistoryInitialized] = useState(false);
  const [shouldLoadActiveConversation, setShouldLoadActiveConversation] =
    useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>(
    [],
  );
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);

  const examplePrompts = useMemo(
    () => [
      "I did 3 sets of bench press: 135lbs x 8, 155lbs x 6, 165lbs x 4. Then squats: 3 sets of 185lbs x 10.",
      "What exercises should I do to improve my bench press?",
      "I ran 3 miles in 24 minutes today, feeling great!",
      "Can you suggest a good leg workout based on my recent training?",
    ],
    [],
  );

  const conversationHistoryQuery = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: getConversationHistory,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const activeConversationQuery = useQuery({
    queryKey: ["chat", "conversation", activeConversationId],
    queryFn: () => getConversation(activeConversationId as number),
    enabled:
      isAuthenticated &&
      activeConversationId !== null &&
      shouldLoadActiveConversation,
    staleTime: 30_000,
  });

  const chatMutation = useMutation({
    mutationFn: ({
      messages: chatMessages,
      conversationId,
    }: {
      messages: ChatApiMessage[];
      conversationId?: number;
    }) => sendChatMessage(chatMessages, conversationId),
    onSuccess: async (response) => {
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
      setConversationError(null);
      setShouldLoadActiveConversation(false);

      if (response.conversation_id) {
        setActiveConversationId(response.conversation_id);
        setHistoryInitialized(true);
        await queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      }

      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
          parts: [{ type: "text", text: message }],
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach((attachment) => {
        URL.revokeObjectURL(attachment.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      setHistoryInitialized(false);
      setShouldLoadActiveConversation(false);
      setConversationError(null);
      return;
    }

    if (historyInitialized || !conversationHistoryQuery.data) {
      return;
    }

    const mostRecentConversation = conversationHistoryQuery.data[0];
    setActiveConversationId(mostRecentConversation?.id ?? null);
    setShouldLoadActiveConversation(Boolean(mostRecentConversation));
    setHistoryInitialized(true);
  }, [conversationHistoryQuery.data, historyInitialized, isAuthenticated]);

  useEffect(() => {
    if (!activeConversationQuery.data) {
      return;
    }

    setMessages(mapConversationToUiMessages(activeConversationQuery.data));
    setConversationError(null);
    setShouldLoadActiveConversation(false);
  }, [activeConversationQuery.data]);

  useEffect(() => {
    if (!activeConversationQuery.error || !shouldLoadActiveConversation) {
      return;
    }

    setConversationError(
      extractErrorMessage(
        activeConversationQuery.error,
        "I couldn't load that conversation.",
      ),
    );
    setShouldLoadActiveConversation(false);
  }, [activeConversationQuery.error, shouldLoadActiveConversation]);

  const clearPendingAttachments = () => {
    pendingAttachmentsRef.current.forEach((attachment) => {
      URL.revokeObjectURL(attachment.previewUrl);
    });
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const buildUserParts = async (
    messageContent: string,
    attachments: PendingAttachment[],
  ): Promise<{ uiParts: UIMessagePart[]; apiParts: ChatApiPart[] }> => {
    const uploadedAttachments = await Promise.all(
      attachments.map((attachment) => uploadChatAttachment(attachment.file)),
    );

    const imageUiParts: UIMessagePart[] = uploadedAttachments.map((attachment) => ({
      type: "image",
      attachment_id: attachment.attachment_id,
      mime_type: attachment.mime_type,
      filename: attachment.filename,
      url: buildAttachmentUrl(attachment.attachment_id),
    }));

    const textPart = messageContent.trim();
    const textUiParts: UIMessagePart[] = textPart
      ? [{ type: "text", text: textPart }]
      : [];

    const apiParts: ChatApiPart[] = [
      ...uploadedAttachments.map((attachment) => ({
        type: "image" as const,
        attachment_id: attachment.attachment_id,
      })),
      ...(textPart ? [{ type: "text" as const, text: textPart }] : []),
    ];

    return {
      uiParts: [...imageUiParts, ...textUiParts],
      apiParts,
    };
  };

  const processMessage = async (messageContent: string) => {
    const trimmedMessage = messageContent.trim();
    if ((!trimmedMessage && pendingAttachments.length === 0) || isLoading) {
      return;
    }

    setIsLoading(true);
    setAttachmentError(null);
    setConversationError(null);
    setShouldLoadActiveConversation(false);

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

      window.setTimeout(() => {
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
      const { uiParts, apiParts } = await buildUserParts(
        trimmedMessage,
        attachmentsSnapshot,
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

      chatMutation.mutate({
        messages: [
          {
            role: "user",
            content: trimmedMessage || undefined,
            parts: apiParts.length > 0 ? apiParts : undefined,
          },
        ],
        conversationId: activeConversationId ?? undefined,
      });
    } catch (error) {
      setAttachmentError(
        extractErrorMessage(
          error,
          "I couldn't upload one of the images. Check the file type/size and try again.",
        ),
      );
      setIsLoading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const invalidType = files.find(
      (file) =>
        !ALLOWED_ATTACHMENT_TYPES.includes(
          file.type as (typeof ALLOWED_ATTACHMENT_TYPES)[number],
        ),
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
    window.setTimeout(async () => {
      await processMessage(prompt);
    }, 100);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void handleSendMessage();
  };

  const handleStartNewChat = () => {
    setActiveConversationId(null);
    setHistoryInitialized(true);
    setShouldLoadActiveConversation(false);
    setMessages([]);
    setConversationError(null);
    setAttachmentError(null);
    setInputValue("");
    clearPendingAttachments();
  };

  const handleSelectConversation = (conversationId: number) => {
    if (conversationId === activeConversationId && !shouldLoadActiveConversation) {
      return;
    }

    clearPendingAttachments();
    setAttachmentError(null);
    setConversationError(null);
    setInputValue("");
    setMessages([]);
    setActiveConversationId(conversationId);
    setHistoryInitialized(true);
    setShouldLoadActiveConversation(true);
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

    const workoutEvent = message.events?.find(
      (event): event is WorkoutCreatedEvent => event.type === "workout_created",
    );

    if (!workoutEvent) {
      return null;
    }

    return <ChatWorkoutWidget event={workoutEvent} />;
  };

  const isHydratingConversation =
    shouldLoadActiveConversation &&
    activeConversationId !== null &&
    activeConversationQuery.isPending;
  const showWelcomeState = messages.length === 0 && !isHydratingConversation;

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden lg:flex-row">
      <aside className="bg-card border-border/20 flex shrink-0 flex-col border-b lg:w-80 lg:border-b-0 lg:border-r">
        <div className="border-border/20 flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="text-muted-foreground h-4 w-4" />
            <h2 className="text-sm font-semibold">Chat history</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg"
            onClick={handleStartNewChat}
          >
            <Plus className="mr-1 h-4 w-4" />
            New chat
          </Button>
        </div>

        <div className="min-h-0 max-h-56 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
          {!isAuthenticated ? (
            <div className="text-muted-foreground rounded-2xl px-3 py-4 text-sm">
              Sign in to access previous conversations.
            </div>
          ) : conversationHistoryQuery.isPending ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-muted/60 h-16 animate-pulse rounded-2xl"
                />
              ))}
            </div>
          ) : conversationHistoryQuery.data?.length ? (
            <div className="space-y-2">
              {conversationHistoryQuery.data.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent bg-muted/40 hover:bg-muted"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">
                      {getConversationTitle(conversation.title)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatConversationTimestamp(conversation.updated_at)}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground rounded-2xl px-3 py-4 text-sm">
              Your saved chats will show up here after the first message.
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="bg-card border-border/20 flex shrink-0 items-center gap-3 border-b px-4 py-3 shadow-sm">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
            <Dumbbell className="text-primary h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base leading-tight font-semibold">
              AI Personal Trainer
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              {activeConversationId
                ? "Continuing saved conversation"
                : "Text + image coaching"}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="mx-auto max-w-4xl">
            {conversationError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {conversationError}
              </div>
            )}

            {isHydratingConversation && (
              <div className="space-y-3 px-2 py-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
                  >
                    <div className="bg-muted/60 h-20 w-full max-w-xl animate-pulse rounded-2xl" />
                  </div>
                ))}
              </div>
            )}

            {showWelcomeState && (
              <div className="px-4 py-8 text-center">
                <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                  <Bot className="text-primary h-8 w-8" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  Welcome to your AI Personal Trainer
                </h3>
                <p className="text-muted-foreground mb-6 text-sm">
                  Ask questions, log workouts, or attach photos for coaching and
                  analysis.
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
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                        message.role === "system" ? "bg-accent/20" : "bg-muted"
                      }`}
                    >
                      <Bot className="text-muted-foreground h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`px-4 py-2.5 ${
                      message.role === "user"
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
                    <div className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full" />
                    <div
                      className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
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
    </div>
  );
};

export default ChatPage;
