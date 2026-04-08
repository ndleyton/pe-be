import { test, expect } from "@playwright/test";

type ConversationSummary = {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

type ConversationDetail = ConversationSummary & {
  messages: Array<{
    id: number;
    role: "user" | "assistant";
    content: string;
    created_at: string;
    parts: Array<{
      type: "text" | "image";
      text?: string;
      attachment_id?: number;
      mime_type?: string;
      filename?: string;
    }>;
  }>;
};

test.describe("Chat history", () => {
  test("loads saved conversations, creates a new one, and switches threads", async ({
    page,
  }) => {
    const now = "2026-03-30T20:00:00Z";
    const firstConversationUpdatedAt = "2026-03-30T19:55:00Z";
    const secondConversationUpdatedAt = "2026-03-30T20:01:00Z";
    let nextConversationMessageId = 200;
    let conversationListCalls = 0;

    const conversationSummaries: ConversationSummary[] = [
      {
        id: 11,
        title: "Shoulders check-in",
        created_at: "2026-03-30T19:45:00Z",
        updated_at: firstConversationUpdatedAt,
        is_active: true,
      },
    ];

    const conversationDetails = new Map<number, ConversationDetail>([
      [
        11,
        {
          id: 11,
          title: "Shoulders check-in",
          created_at: "2026-03-30T19:45:00Z",
          updated_at: firstConversationUpdatedAt,
          is_active: true,
          messages: [
            {
              id: 1,
              role: "user",
              content: "How should I adjust my shoulder volume?",
              created_at: "2026-03-30T19:46:00Z",
              parts: [
                {
                  type: "text",
                  text: "How should I adjust my shoulder volume?",
                },
              ],
            },
            {
              id: 2,
              role: "assistant",
              content: "Keep presses heavy and lateral raises moderate.",
              created_at: "2026-03-30T19:47:00Z",
              parts: [
                {
                  type: "text",
                  text: "Keep presses heavy and lateral raises moderate.",
                },
              ],
            },
          ],
        },
      ],
    ]);

    await page.route("**/api/v1/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          email: "chat-tester@example.com",
          name: "Chat Tester",
        }),
      });
    });

    await page.route("**/api/v1/workouts/mine**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], next_cursor: null }),
      });
    });

    await page.route("**/api/v1/conversations", async (route) => {
      conversationListCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversations: conversationSummaries,
          total: conversationSummaries.length,
          limit: 20,
          offset: 0,
        }),
      });
    });

    await page.route("**/api/v1/conversations/*", async (route) => {
      const conversationId = Number(route.request().url().split("/").pop());
      const detail = conversationDetails.get(conversationId);

      if (!detail) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Conversation not found" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail),
      });
    });

    await page.route("**/api/v1/chat", async (route) => {
      const payload = route.request().postDataJSON() as {
        messages: Array<{ content?: string }>;
        conversation_id?: number;
      };

      expect(payload.conversation_id).toBeUndefined();
      expect(payload.messages).toHaveLength(1);
      expect(payload.messages[0]?.content).toBe("Build me a leg day plan");

      const newConversationId = 22;
      const assistantReply =
        "Start with squats, then Romanian deadlifts, then walking lunges.";

      if (!conversationDetails.has(newConversationId)) {
        conversationDetails.set(newConversationId, {
          id: newConversationId,
          title: "Build me a leg day plan",
          created_at: now,
          updated_at: secondConversationUpdatedAt,
          is_active: true,
          messages: [],
        });
      }

      const detail = conversationDetails.get(newConversationId)!;
      detail.messages = [
        {
          id: nextConversationMessageId++,
          role: "user",
          content: "Build me a leg day plan",
          created_at: now,
          parts: [{ type: "text", text: "Build me a leg day plan" }],
        },
        {
          id: nextConversationMessageId++,
          role: "assistant",
          content: assistantReply,
          created_at: now,
          parts: [{ type: "text", text: assistantReply }],
        },
      ];
      detail.updated_at = secondConversationUpdatedAt;

      conversationSummaries.unshift({
        id: newConversationId,
        title: "Build me a leg day plan",
        created_at: now,
        updated_at: secondConversationUpdatedAt,
        is_active: true,
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: assistantReply,
          conversation_id: newConversationId,
        }),
      });
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });

    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: "Shoulders check-in" }),
    ).toBeVisible();
    await expect(
      page.getByText("Keep presses heavy and lateral raises moderate."),
    ).toBeVisible();

    await page.getByRole("button", { name: "New chat" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome to your AI Personal Trainer" }),
    ).toBeVisible();

    const messageInput = page.getByPlaceholder("Message...");
    await messageInput.fill("Build me a leg day plan");
    await messageInput.press("Enter");

    await expect(
      page.getByText(
        "Start with squats, then Romanian deadlifts, then walking lunges.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Build me a leg day plan" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Shoulders check-in" }).click();
    await expect(
      page.getByText("Keep presses heavy and lateral raises moderate."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Start with squats, then Romanian deadlifts, then walking lunges.",
      ),
    ).not.toBeVisible();

    expect(conversationListCalls).toBeGreaterThanOrEqual(2);
  });
});
