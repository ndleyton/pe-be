import { Bot } from "lucide-react";

import { ChatExerciseSubstitutionsWidget } from "./ChatExerciseSubstitutionsWidget";
import { ChatMessageBody } from "./ChatMessageBody";
import { ChatRoutineWidget } from "./ChatRoutineWidget";
import { ChatWorkoutWidget } from "./ChatWorkoutWidget";
import { type ChatMessage } from "../types";

interface ChatMessageItemProps {
  message: ChatMessage;
}

const renderMessageWidget = (message: ChatMessage) => {
  if (message.role !== "assistant" || !message.events?.length) {
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

export const ChatMessageItem = ({ message }: ChatMessageItemProps) => {
  return (
    <div
      className={`mb-2 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex max-w-[88%] gap-2 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
      >
        {message.role !== "user" && (
          <div
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${message.role === "system" ? "bg-accent/20" : "bg-muted"}`}
          >
            <Bot className="text-muted-foreground h-4 w-4" />
          </div>
        )}
        <div
          className={`px-4 py-2.5 ${message.role === "user"
            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
            : message.role === "system"
              ? "bg-accent/50 text-accent-foreground rounded-2xl shadow-sm"
              : "bg-muted/80 text-foreground rounded-2xl rounded-tl-sm shadow-sm"}`}
        >
          <ChatMessageBody message={message} />
          {renderMessageWidget(message)}
        </div>
      </div>
    </div>
  );
};
