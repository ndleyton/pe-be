export const normalizeChatCopy = (message: string) =>
  message
    .replace(/with Gemini/gi, "with the AI coach")
    .replace(/\bGemini\b/gi, "AI coach");
