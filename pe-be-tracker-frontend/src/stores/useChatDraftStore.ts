import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createIndexedDBStorage } from "./indexedDBStorage";
import type { PendingAttachment } from "@/features/chat/types";

interface ChatDraftState {
  texts: Record<string, string>;
  attachments: Record<string, PendingAttachment[]>;
  hydrated: boolean;
  setText: (key: string, text: string) => void;
  setAttachments: (
    key: string,
    update: PendingAttachment[] | ((current: PendingAttachment[]) => PendingAttachment[]),
  ) => void;
}

export const chatDraftKey = (userId: number | undefined, conversationId?: number) =>
  `${userId ?? "guest"}:${conversationId ?? "new"}`;

export const useChatDraftStore = create<ChatDraftState>()(
  persist(
    (set) => ({
      texts: {},
      attachments: {},
      hydrated: false,
      setText: (key, text) => set((state) => ({ texts: { ...state.texts, [key]: text } })),
      setAttachments: (key, update) => set((state) => ({
        attachments: {
          ...state.attachments,
          [key]: typeof update === "function" ? update(state.attachments[key] ?? []) : update,
        },
      })),
    }),
    {
      name: "chat-drafts",
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({ texts: state.texts }),
      // Edits made during asynchronous hydration take precedence over saved text.
      merge: (persisted, current) => ({
        ...current,
        texts: { ...(persisted as Partial<ChatDraftState> | undefined)?.texts, ...current.texts },
      }),
      onRehydrateStorage: () => () => {
        useChatDraftStore.setState({ hydrated: true });
      },
    },
  ),
);
