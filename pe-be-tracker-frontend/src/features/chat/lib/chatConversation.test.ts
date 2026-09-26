import { describe, expect, it } from "vitest";
import { reconcileConversationMessages } from "./chatConversation";
import type { ConversationResponse } from "../types";

const conversation: ConversationResponse = {
  id: 12,
  created_at: "2024-01-02",
  updated_at: "2024-01-02",
  is_active: true,
  messages: [{ id: 1, role: "assistant", content: "Updated plan", parts: [], created_at: "2024-01-02" }],
};

describe("reconcileConversationMessages", () => {
  it("updates a server message by identity while retaining unmatched local messages", () => {
    const localPrompt = { id: "local-prompt", role: "assistant" as const, content: "Any equipment constraints?", timestamp: new Date() };
    const merged = reconcileConversationMessages(conversation, [
      { id: "conversation-message-1", role: "assistant", content: "Old plan", timestamp: new Date() },
      localPrompt,
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ id: "conversation-message-1", content: "Updated plan" });
    expect(merged[1]).toEqual(localPrompt);
  });

  it("prefers a server identity match over identical local text", () => {
    const local = { id: "local", role: "assistant" as const, content: "Updated plan", timestamp: new Date() };
    const merged = reconcileConversationMessages(conversation, [
      local,
      { id: "conversation-message-1", role: "assistant", content: "Old plan", timestamp: new Date() },
    ]);
    expect(merged.map((message) => message.id)).toEqual(["conversation-message-1", "local"]);
  });

  it("loads the server transcript when the cache is empty", () => {
    expect(reconcileConversationMessages(conversation, [])).toHaveLength(1);
  });
});
