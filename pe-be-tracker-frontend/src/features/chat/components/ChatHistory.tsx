import { useInfiniteQuery } from "@tanstack/react-query";
import { getConversations } from "../api/chatApi";
import { Button } from "@/shared/components/ui/button";

interface ChatHistoryProps {
  conversationId?: number;
  userId?: number;
  disabled: boolean;
  onSelect: (id: number) => void;
}

export const ChatHistory = ({ conversationId, userId, disabled, onSelect }: ChatHistoryProps) => {
  const history = useInfiniteQuery({
    queryKey: ["chat-history", userId],
    queryFn: ({ pageParam }) => getConversations(pageParam),
    initialPageParam: 0,
    getNextPageParam: (page) => page.offset + page.limit < page.total
      ? page.offset + page.limit
      : undefined,
    staleTime: 0,
  });

  return (
    <section aria-label="Chat history" className="border-border/20 max-h-64 shrink-0 overflow-y-auto border-b px-4 py-3">
      <h2 className="mb-2 font-semibold">Past chats</h2>
      {history.isPending && <p role="status">Loading chats…</p>}
      {history.isError && (
        <div role="alert">
          Could not load chat history.
          <Button variant="ghost" onClick={() => void history.refetch()}>Retry</Button>
        </div>
      )}
      {history.data?.pages[0].total === 0 && <p>No past chats yet.</p>}
      <ul className="space-y-1">
        {history.data?.pages.flatMap((page) => page.conversations).map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              disabled={disabled}
              aria-current={conversationId === conversation.id ? "true" : undefined}
              className="hover:bg-muted aria-[current=true]:bg-muted flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left disabled:opacity-50"
              onClick={() => onSelect(conversation.id)}
            >
              <span className="truncate">{conversation.title || `Chat ${conversation.id}`}</span>
              <time className="text-muted-foreground shrink-0 text-xs" dateTime={conversation.updated_at}>
                {new Date(conversation.updated_at).toLocaleDateString()}
              </time>
            </button>
          </li>
        ))}
      </ul>
      {history.hasNextPage && (
        <Button variant="ghost" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
          {history.isFetchingNextPage ? "Loading…" : "Load more chats"}
        </Button>
      )}
    </section>
  );
};
