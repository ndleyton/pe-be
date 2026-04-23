import { type RefObject } from "react";

import { ChatMessageItem } from "./ChatMessageItem";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { type ChatMessage } from "../types";

interface ChatTranscriptProps {
  isLoading: boolean;
  messages: ChatMessage[];
  messagesEndRef?: RefObject<HTMLDivElement | null>;
}

export const ChatTranscript = ({
  isLoading,
  messages,
  messagesEndRef,
}: ChatTranscriptProps) => {
  return (
    <>
      {messages.map((message) => (
        <ChatMessageItem key={message.id} message={message} />
      ))}

      {isLoading && <ChatTypingIndicator />}

      <div ref={messagesEndRef} />
    </>
  );
};
