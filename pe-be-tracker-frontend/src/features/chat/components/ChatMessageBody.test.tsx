import { render, screen } from "@/test/testUtils";
import { describe, expect, it } from "vitest";

import { ChatMessageBody } from "./ChatMessageBody";

describe("ChatMessageBody", () => {
  it("renders assistant markdown and image parts", () => {
    render(
      <ChatMessageBody
        message={{
          id: "assistant-1",
          role: "assistant",
          content: "**Strong**",
          parts: [
            {
              type: "image",
              attachment_id: 9,
              filename: "photo.png",
              url: "https://example.com/photo.png",
            },
            {
              type: "text",
              text: "**Strong**\n\n- First item",
            },
          ],
          timestamp: new Date("2024-01-02T18:00:00.000Z"),
        }}
      />,
    );

    expect(screen.getByAltText("photo.png")).toHaveAttribute(
      "src",
      "https://example.com/photo.png",
    );
    expect(screen.getByText("Strong").tagName).toBe("STRONG");
    expect(screen.getByText("First item")).toBeInTheDocument();
  });

  it("renders user copy as plain text", () => {
    render(
      <ChatMessageBody
        message={{
          id: "user-1",
          role: "user",
          content: "**Not markdown rendered**",
          parts: [
            {
              type: "text",
              text: "**Not markdown rendered**",
            },
          ],
          timestamp: new Date("2024-01-02T18:00:00.000Z"),
        }}
      />,
    );

    expect(screen.getByText("**Not markdown rendered**")).toBeInTheDocument();
  });
});
