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
  const imageParts = parts.filter(
    (part): part is ImageMessagePart => part.type === "image",
  );
  const textParts = parts.filter(
    (part): part is TextMessagePart => part.type === "text",
  );
  const markdown = textParts.map((part) => part.text).join("\n\n") || message.content;

  return (
    <>
      {imageParts.length > 0 && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {imageParts.map((part) => (
            <img
              key={`${message.id}-${part.attachment_id}`}
              src={part.url}
              alt={part.filename || "Chat attachment"}
              className="border-border/30 max-h-64 w-full rounded-2xl border object-cover"
            />
          ))}
        </div>
      )}
      <div className="text-sm">
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
            {markdown || ""}
          </ReactMarkdown>
        ) : (
          <p className="leading-relaxed">{markdown}</p>
        )}
      </div>
    </>
  );
};
