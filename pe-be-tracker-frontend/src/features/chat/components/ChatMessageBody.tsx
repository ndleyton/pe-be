import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  type ChatMessage,
  type ImageMessagePart,
  type TextMessagePart,
} from "../types";

interface ChatMessageBodyProps {
  message: ChatMessage;
}

export const ChatMessageBody = ({ message }: ChatMessageBodyProps) => {
  const parts = message.parts ?? [];
  const renderableBlocks: Array<
    | { id: string; type: "images"; parts: ImageMessagePart[] }
    | { id: string; type: "text"; text: string }
  > = [];

  if (parts.length === 0) {
    if (message.content) {
      renderableBlocks.push({
        id: "content-fallback",
        type: "text",
        text: message.content,
      });
    }
  } else {
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.type === "image") {
        const lastBlock = renderableBlocks[renderableBlocks.length - 1];
        if (lastBlock && lastBlock.type === "images") {
          lastBlock.parts.push(part as ImageMessagePart);
        } else {
          renderableBlocks.push({
            id: `block-${i}`,
            type: "images",
            parts: [part as ImageMessagePart],
          });
        }
      } else if (part.type === "text") {
        const lastBlock = renderableBlocks[renderableBlocks.length - 1];
        if (lastBlock && lastBlock.type === "text") {
          lastBlock.text += "\n\n" + (part as TextMessagePart).text;
        } else {
          renderableBlocks.push({
            id: `block-${i}`,
            type: "text",
            text: (part as TextMessagePart).text,
          });
        }
      }
    }
  }

  return (
    <>
      {renderableBlocks.map((block) => {
        if (block.type === "images") {
          return (
            <div
              key={block.id}
              className="mb-3 grid gap-2 sm:grid-cols-2 last:mb-0"
            >
              {block.parts.map((part, index) => (
                <img
                  key={`${message.id}-img-${part.attachment_id ?? index}`}
                  src={part.url}
                  alt={part.filename || "Chat attachment"}
                  className="border-border/30 max-h-64 w-full rounded-2xl border object-cover"
                />
              ))}
            </div>
          );
        }

        if (block.type === "text") {
          return (
            <div key={block.id} className="text-sm mb-3 last:mb-0">
              {message.role === "assistant" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children, ...props }) => (
                      <p className="mb-2 leading-relaxed last:mb-0" {...props}>
                        {children}
                      </p>
                    ),
                    ul: ({ children, ...props }) => (
                      <ul className="mb-2 list-inside list-disc space-y-1" {...props}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children, ...props }) => (
                      <ol
                        className="mb-2 list-inside list-decimal space-y-1"
                        {...props}
                      >
                        {children}
                      </ol>
                    ),
                    li: ({ children, ...props }) => (
                      <li className="mb-0.5" {...props}>
                        {children}
                      </li>
                    ),
                    strong: ({ children, ...props }) => (
                      <strong className="font-semibold" {...props}>
                        {children}
                      </strong>
                    ),
                    em: ({ children, ...props }) => (
                      <em className="italic" {...props}>
                        {children}
                      </em>
                    ),
                    code: ({ children, ...props }) => {
                      const isInline = !props.className?.includes("language-");
                      return isInline ? (
                        <code
                          className="bg-background/50 rounded-md px-1.5 py-0.5 font-mono text-xs"
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <code {...props}>{children}</code>
                      );
                    },
                    pre: ({ children, ...props }) => (
                      <pre
                        className="bg-background/50 mb-2 overflow-x-auto rounded-lg p-2 text-xs"
                        {...props}
                      >
                        {children}
                      </pre>
                    ),
                    h1: ({ children, ...props }) => (
                      <h1 className="mb-2 text-base font-bold" {...props}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children, ...props }) => (
                      <h2 className="mb-1.5 text-sm font-bold" {...props}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children, ...props }) => (
                      <h3 className="mb-1 text-sm font-semibold" {...props}>
                        {children}
                      </h3>
                    ),
                    blockquote: ({ children, ...props }) => (
                      <blockquote
                        className="border-border my-2 border-l-2 pl-3 italic"
                        {...props}
                      >
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {block.text || ""}
                </ReactMarkdown>
              ) : (
                <p className="leading-relaxed">{block.text}</p>
              )}
            </div>
          );
        }

        return null;
      })}
    </>
  );
};
