import { Bot } from "lucide-react";

interface ChatEmptyStateProps {
  examplePrompts: string[];
  isAuthenticated: boolean;
  isRestoring?: boolean;
  onExamplePrompt: (prompt: string) => void;
}

export const ChatEmptyState = ({
  examplePrompts,
  isAuthenticated,
  isRestoring = false,
  onExamplePrompt,
}: ChatEmptyStateProps) => {
  if (isRestoring) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <Bot className="text-primary h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Restoring chat</h3>
        <p className="text-muted-foreground text-sm">
          Loading your latest conversation for this session.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 text-center">
      <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <Bot className="text-primary h-8 w-8" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">Meet Personal Bestie</h3>
      <p className="text-muted-foreground mb-6 text-sm">
        Ask questions, log workouts, get coaching, or create a personalized
        routine just for you.
      </p>
      <div className="mx-auto max-w-md space-y-2">
        <p className="text-muted-foreground mb-3 text-xs font-medium">
          Try these examples:
        </p>
        {examplePrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onExamplePrompt(prompt)}
            className="bg-muted/50 hover:bg-muted w-full rounded-2xl px-4 py-3 text-left text-sm transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
      {!isAuthenticated && (
        <div className="bg-destructive/10 mx-auto mt-6 max-w-md rounded-2xl px-4 py-3">
          <p className="text-destructive text-sm">
            Sign in to use chat and image uploads. This feature is for logged-in
            users.
          </p>
        </div>
      )}
    </div>
  );
};
