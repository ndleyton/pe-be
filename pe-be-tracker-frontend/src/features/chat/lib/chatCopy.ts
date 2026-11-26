export const CHAT_EXAMPLE_PROMPTS = [
  "I did 3 sets of bench press: 135lbs x 8, 155lbs x 6, 165lbs x 4. Then squats: 3 sets of 185lbs x 10.",
  "What exercises should I do to improve my bench press?",
  "I ran 3 miles in 24 minutes today, feeling great!",
  "Can you suggest a good leg workout based on my recent training?",
];

export const normalizeChatCopy = (message: string) =>
  message
    .replace(/with Gemini/gi, "with the AI coach")
    .replace(/\bGemini\b/gi, "AI coach");
