import "dotenv/config";

import Groq from "groq-sdk";

export const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";

let groqClientInstance: Groq | null = null;

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GROQ_API_KEY environment variable. Please add your free GROQ_API_KEY to your .env file."
    );
  }

  if (!groqClientInstance) {
    // Handle CJS/ESM interop where default export may be nested
    const GroqCtor = (Groq as unknown as { default?: typeof Groq }).default ?? Groq;
    groqClientInstance = new GroqCtor({ apiKey });
  }

  if (!groqClientInstance?.chat?.completions?.create) {
    groqClientInstance = null;
    throw new Error("Groq client failed to initialize chat.completions API");
  }

  return groqClientInstance;
}

/**
 * Rewrites a follow-up query into a standalone search query using Groq.
 */
export async function rewriteFollowupQuery(
  userQuery: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  if (!history || history.length === 0) {
    return userQuery;
  }

  try {
    const groq = getGroqClient();
    const recentHistory = history.slice(-6);

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a search query reformulation assistant for an e-commerce store.
Your job is to rewrite the customer's follow-up question into a single, self-contained product search query based on conversation history.
- Do NOT answer the question.
- Resolve all pronouns ("it", "they", "those", "the cheap one", "the other color") into concrete product terms mentioned in history.
- Return ONLY the rewritten query text, with no quotes, punctuation, or preamble.
- If already self-contained or a new topic, return it unchanged.`,
        },
        ...recentHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        {
          role: "user",
          content: userQuery,
        },
      ],
    });

    const rewritten = completion.choices[0]?.message?.content?.trim();
    return rewritten && rewritten.length > 0 ? rewritten : userQuery;
  } catch (error) {
    console.warn("Failed to rewrite query with Groq, falling back to original query:", error);
    return userQuery;
  }
}

/**
 * Generates a streaming chat response using Groq.
 */
export async function streamChatWithGroq(
  systemInstruction: string,
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string
) {
  const groq = getGroqClient();
  const cappedHistory = history.slice(-6);

  const messages = [
    { role: "system" as const, content: systemInstruction },
    ...cappedHistory.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  return await groq.chat.completions.create({
    model: GROQ_CHAT_MODEL,
    temperature: 0.1,
    stream: true,
    messages,
  });
}
