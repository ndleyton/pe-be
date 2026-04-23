import { Bot } from "lucide-react";

export const ChatTypingIndicator = () => {
  return (
    <div className="mb-2 flex gap-2" role="status" aria-label="Assistant is typing">
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
  );
};
