import { useRef } from "react";
import { LoadingStatus } from "@/shared/components/ui/loading-status";
import { CHAT_EXAMPLE_PROMPTS } from "../../lib/chatCopy";
import { ChatComposer } from "../ChatComposer";
import { ChatEmptyState } from "../ChatEmptyState";
import { ChatHeader } from "../ChatHeader";

const noop = () => {};

const ChatPageSkeleton = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="bg-background flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-4rem)]"
      aria-busy="true"
    >
      <LoadingStatus message="Loading chat" />
      <ChatHeader disableNewChat onStartNewChat={noop} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto max-w-4xl">
          <ChatEmptyState
            examplePrompts={CHAT_EXAMPLE_PROMPTS}
            isAuthenticated={false}
            showSignInNotice={false}
            disablePrompts
            onExamplePrompt={noop}
          />
        </div>
      </div>
      <ChatComposer
        attachmentError={null}
        canAddAttachments={false}
        canSubmit={false}
        fileInputRef={fileInputRef}
        inputValue=""
        isLoading
        onFileChange={noop}
        onInputChange={noop}
        onRemoveAttachment={noop}
        onSubmit={noop}
        pendingAttachments={[]}
      />
    </div>
  );
};

export default ChatPageSkeleton;
