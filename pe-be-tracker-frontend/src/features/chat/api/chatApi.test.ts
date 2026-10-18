import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock("@/shared/api/client", () => ({ default: { post: mockPost } }));

import { sendChatMessage } from "./chatApi";

const ndjson = (...events: object[]) =>
  events.map((event) => `${JSON.stringify(event)}\n`).join("");

describe("sendChatMessage", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("reports each complete delta line once and returns the done payload", async () => {
    const body = ndjson(
      { type: "delta", text: "Hel" },
      { type: "delta", text: "lo" },
      { type: "done", message: "Hello", conversation_id: 3, events: [] },
    );
    mockPost.mockImplementation(async (_url, _data, config) => {
      // Progress fires with partial lines and repeated full text, as XHR does.
      const firstLineEnd = body.indexOf("\n") + 1;
      for (const text of [body.slice(0, 5), body.slice(0, firstLineEnd + 4), body, body]) {
        config.onDownloadProgress({ event: { target: { responseText: text } } });
      }
      return { data: body };
    });
    const onDelta = vi.fn();

    const response = await sendChatMessage([{ role: "user", content: "Hi" }], 3, onDelta);

    expect(mockPost).toHaveBeenCalledWith(
      "/chat/stream",
      { messages: [{ role: "user", content: "Hi" }], conversation_id: 3 },
      expect.objectContaining({ responseType: "text" }),
    );
    expect(onDelta.mock.calls).toEqual([["Hel"], ["lo"]]);
    expect(response).toEqual({ message: "Hello", conversation_id: 3, events: [] });
  });

  it("throws the streamed error detail in the axios error shape", async () => {
    mockPost.mockResolvedValue({
      data: ndjson({ type: "error", detail: "The AI service is currently busy." }),
    });

    await expect(sendChatMessage([{ role: "user", content: "Hi" }])).rejects.toMatchObject({
      response: { data: { detail: "The AI service is currently busy." } },
    });
  });
});
