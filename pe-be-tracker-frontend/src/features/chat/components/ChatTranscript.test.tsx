import { render, screen } from "@/test/testUtils";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { ChatTranscript } from "./ChatTranscript";

describe("ChatTranscript", () => {
  it("renders assistant widgets from transcript events", () => {
    render(
      <ChatTranscript
        isLoading={false}
        messages={[
          {
            id: "assistant-routine",
            role: "assistant",
            content: "I created a routine for you.",
            parts: [{ type: "text", text: "I created a routine for you." }],
            events: [
              {
                type: "routine_created",
                title: "Routine created",
                ctaLabel: "View routine",
                routine: {
                  id: 77,
                  name: "Beginner Full Body",
                  description: "Built for three gym days per week.",
                  workout_type_id: 4,
                  exercise_count: 6,
                  set_count: 18,
                },
              },
            ],
            timestamp: new Date("2024-01-02T18:00:00.000Z"),
          },
        ]}
        messagesEndRef={createRef<HTMLDivElement>()}
      />,
    );

    expect(screen.getByText("I created a routine for you.")).toBeInTheDocument();
    expect(screen.getByText("Beginner Full Body")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View routine" })).toHaveAttribute(
      "href",
      "/routines/77",
    );
  });

  it("renders the typing indicator while the assistant response is pending", () => {
    render(
      <ChatTranscript
        isLoading={true}
        messages={[]}
        messagesEndRef={createRef<HTMLDivElement>()}
      />,
    );

    expect(screen.getByRole("status", { name: "Assistant is typing" })).toBeInTheDocument();
  });
});
