import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  ChatComposer,
  ChatEmptyState,
  ChatHeader,
  ChatTranscript,
} from "../components";
import {
  useChatComposer,
  useChatSessionRestore,
  useChatSubstitutionIntent,
} from "../hooks";
import { type ChatPageLocationState } from "../types";
import { useAuthStore } from "@/stores";

import { ChatHistory } from "../components/ChatHistory";

const EXAMPLE_PROMPTS = [
  "I did 3 sets of bench press: 135lbs x 8, 155lbs x 6, 165lbs x 4. Then squats: 3 sets of 185lbs x 10.",
  "What exercises should I do to improve my bench press?",
  "I ran 3 miles in 24 minutes today, feeling great!",
  "Can you suggest a good leg workout based on my recent training?",
];

const ChatPage = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as ChatPageLocationState | null;
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    conversationId,
    openConversation,
    restoreError,
    messages,
    restorationResolved,
    resetConversationState,
    setConversationId,
    setMessages,
  } = useChatSessionRestore({
    isAuthenticated,
  });

  const { clearPendingSubstitutionIntent, pendingSubstitutionIntent } =
    useChatSubstitutionIntent({
      autoStartChatIntent: routeState?.autoStartChatIntent === true,
      chatIntent: routeState?.chatIntent,
      location,
      messages,
      navigate,
      restorationResolved,
      routeState,
      setMessages,
    });

  const {
    attachmentError,
    canAddAttachments,
    canSubmitMessage,
    fileInputRef,
    handleExamplePrompt,
    handleFileChange,
    handleInputChange,
    handleRemoveAttachment,
    handleSubmitMessage,
    inputValue,
    isLoading,
    pendingAttachments,
    resetComposer,
  } = useChatComposer({
    clearPendingSubstitutionIntent,
    conversationId,
    isAuthenticated,
    pendingSubstitutionIntent,
    setConversationId,
    setMessages,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [isLoading, messages]);

  const handleStartNewChat = () => {
    if (isLoading || !restorationResolved) {
      return;
    }

    clearPendingSubstitutionIntent();
    resetComposer();
    resetConversationState();
  };

  const showRestoringState = isAuthenticated && !restorationResolved && messages.length === 0;
  const showEmptyState = restorationResolved && messages.length === 0;

  return (
    <div className="bg-background flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-4rem)]">
      <ChatHeader
        onStartNewChat={handleStartNewChat}
        onToggleHistory={isAuthenticated ? () => setHistoryOpen((open) => !open) : undefined}
        historyOpen={historyOpen}
        disableNewChat={isLoading || !restorationResolved || (messages.length === 0 && !conversationId)}
      />

      {isAuthenticated && historyOpen && (
        <ChatHistory
          userId={userId}
          conversationId={conversationId}
          disabled={isLoading || !restorationResolved}
          onSelect={(id) => {
            void openConversation(id).then((opened) => {
              if (opened) {
                clearPendingSubstitutionIntent();
                resetComposer();
                setHistoryOpen(false);
              }
            });
          }}
        />
      )}
      {restoreError && <p role="alert" className="px-4 py-2 text-sm">{restoreError}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto max-w-4xl">
          {showRestoringState && (
            <ChatEmptyState
              examplePrompts={EXAMPLE_PROMPTS}
              isAuthenticated={isAuthenticated}
              isRestoring={true}
              onExamplePrompt={handleExamplePrompt}
            />
          )}

          {showEmptyState && (
            <ChatEmptyState
              examplePrompts={EXAMPLE_PROMPTS}
              isAuthenticated={isAuthenticated}
              onExamplePrompt={handleExamplePrompt}
            />
          )}

          {messages.length > 0 && (
            <ChatTranscript
              isLoading={isLoading}
              messages={messages}
              messagesEndRef={messagesEndRef}
            />
          )}
        </div>
      </div>

      <ChatComposer
        attachmentError={attachmentError}
        canAddAttachments={canAddAttachments}
        canSubmit={canSubmitMessage && restorationResolved}
        fileInputRef={fileInputRef}
        inputValue={inputValue}
        isLoading={isLoading || !restorationResolved}
        onFileChange={handleFileChange}
        onInputChange={handleInputChange}
        onRemoveAttachment={handleRemoveAttachment}
        onSubmit={() => {
          if (restorationResolved) void handleSubmitMessage();
        }}
        pendingAttachments={pendingAttachments}
      />
    </div>
  );
};

export default ChatPage;
