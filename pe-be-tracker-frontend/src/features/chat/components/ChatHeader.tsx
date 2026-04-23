import { Dumbbell } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

interface ChatHeaderProps {
  disableNewChat: boolean;
  onStartNewChat: () => void;
}

export const ChatHeader = ({
  disableNewChat,
  onStartNewChat,
}: ChatHeaderProps) => {
  return (
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
        onClick={onStartNewChat}
        disabled={disableNewChat}
      >
        New chat
      </Button>
    </div>
  );
};
